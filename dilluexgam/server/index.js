require('dotenv').config();
const path = require('path'), http = require('http'), express = require('express'), jwt = require('jsonwebtoken'), bcrypt = require('bcryptjs');
const { Server } = require('socket.io'); const store = require('./store'); const { Okey } = require('./okey'); const { Monopoly, BOARD } = require('./monopoly');
const SECRET = process.env.JWT_SECRET; if (!SECRET) { console.error('JWT_SECRET tanımlı değil (.env).'); process.exit(1); }
const app = express(), server = http.createServer(app), io = new Server(server);
app.use(express.json({ limit: '10kb' })); app.use(express.static(path.join(__dirname, '..', 'public')));
const sign = u => jwt.sign({ id: u.id }, SECRET, { expiresIn: '30d' });
const authHttp = async (req, res, next) => { try { req.user = await store.byId(jwt.verify((req.headers.authorization || '').slice(7), SECRET).id); if (!req.user) throw 0; next(); } catch { res.status(401).json({ error: 'Giriş gerekli' }); } };
app.post('/api/register', async (req, res) => {
  const { username = '', email = '', password = '' } = req.body || {};
  if (!/^[\wÇĞİÖŞÜçğıöşü]{3,20}$/.test(username)) return res.status(400).json({ error: 'Kullanıcı adı 3-20 harf/rakam olmalı' });
  if (!/^\S+@\S+\.\S+$/.test(email)) return res.status(400).json({ error: 'Geçerli e-posta girin' });
  if (password.length < 6) return res.status(400).json({ error: 'Şifre en az 6 karakter olmalı' });
  try { const u = await store.createUser(username, email.toLowerCase(), await bcrypt.hash(password, 10)); res.json({ token: sign(u), user: store.pub(u) }); }
  catch (e) { res.status(e.code === '23505' ? 409 : 500).json({ error: e.code === '23505' ? 'Bu kullanıcı adı veya e-posta kayıtlı' : 'Sunucu hatası' }); }
});
app.post('/api/login', async (req, res) => {
  const u = await store.byEmail(String(req.body?.email || '').toLowerCase());
  if (!u || !(await bcrypt.compare(String(req.body?.password || ''), u.pass_hash))) return res.status(401).json({ error: 'E-posta veya şifre hatalı' });
  res.json({ token: sign(u), user: store.pub(u) });
});
app.get('/api/me', authHttp, async (req, res) => res.json({ user: store.pub(req.user), history: await store.history(req.user.id) }));
app.get('/api/board', (_, res) => res.json(BOARD));

const rooms = new Map(), userRoom = new Map(), online = new Map(); // online: userId -> socket sayısı
const LIM = { okey: [4, 4], monopoly: [2, 4] };
const code = () => { let c; do { c = Math.random().toString(36).slice(2, 7).toUpperCase(); } while (rooms.has(c)); return c; };
const lobby = () => [...rooms.values()].filter(r => !r.priv && !r.engine).map(r => ({ code: r.code, game: r.game, host: r.players[0].name, n: r.players.length, max: LIM[r.game][1] }));
const bcastLobby = () => { io.to('lobby').emit('rooms', lobby()); io.emit('online', online.size); };
function push(r) {
  r.players.forEach((p, i) => p.sid && io.to(p.sid).emit('room', { code: r.code, game: r.game, priv: r.priv, host: r.players[0].id, started: !!r.engine,
    players: r.players.map(x => ({ name: x.name, connected: !!x.sid, avatar: x.avatar })), state: r.engine ? r.engine.view(i) : null }));
}
function leave(uid) {
  const r = rooms.get(userRoom.get(uid)); userRoom.delete(uid); if (!r) return;
  if (r.engine && !r.engine.over) return; // oyun sürerken ayrılan oyuncu yerini korur (yeniden bağlanabilir)
  r.players = r.players.filter(p => p.id !== uid);
  if (!r.players.length) rooms.delete(r.code); else push(r);
}
io.use(async (s, next) => { try { s.user = await store.byId(jwt.verify(s.handshake.auth.token, SECRET).id); s.user ? next() : next(new Error('auth')); } catch { next(new Error('auth')); } });
io.on('connection', s => {
  const u = s.user; online.set(u.id, (online.get(u.id) || 0) + 1); s.join('lobby');
  const r0 = rooms.get(userRoom.get(u.id));
  if (r0) { const p = r0.players.find(x => x.id === u.id); p.sid = s.id; push(r0); } // yeniden bağlanma
  s.emit('rooms', lobby()); bcastLobby();
  s.on('room:create', ({ game, priv }, ack) => {
    if (!LIM[game]) return ack?.({ error: 'Geçersiz oyun' }); if (userRoom.has(u.id)) return ack?.({ error: 'Zaten bir odadasın' });
    const r = { code: code(), game, priv: !!priv, engine: null, players: [{ id: u.id, name: u.username, avatar: u.avatar, sid: s.id }] };
    rooms.set(r.code, r); userRoom.set(u.id, r.code); push(r); bcastLobby(); ack?.({ code: r.code });
  });
  s.on('room:join', ({ code: c }, ack) => {
    const r = rooms.get(String(c || '').toUpperCase().trim()); if (!r) return ack?.({ error: 'Oda bulunamadı' });
    if (userRoom.has(u.id)) return ack?.({ error: 'Zaten bir odadasın' }); if (r.engine) return ack?.({ error: 'Oyun başlamış' });
    if (r.players.length >= LIM[r.game][1]) return ack?.({ error: 'Oda dolu' });
    r.players.push({ id: u.id, name: u.username, avatar: u.avatar, sid: s.id }); userRoom.set(u.id, r.code); push(r); bcastLobby(); ack?.({ code: r.code });
  });
  s.on('room:leave', () => { leave(u.id); bcastLobby(); });
  s.on('room:start', (_, ack) => {
    const r = rooms.get(userRoom.get(u.id)); if (!r || r.players[0].id !== u.id) return ack?.({ error: 'Yalnızca oda sahibi başlatır' });
    const [mn] = LIM[r.game]; if (r.players.length < mn) return ack?.({ error: `En az ${mn} oyuncu gerekir` }); if (r.engine) return;
    const pl = r.players.map(p => ({ id: p.id, name: p.name })); r.engine = r.game === 'okey' ? new Okey(pl) : new Monopoly(pl);
    push(r); bcastLobby(); ack?.({});
  });
  s.on('game:act', async (a, ack) => {
    const r = rooms.get(userRoom.get(u.id)); if (!r?.engine) return ack?.({ error: 'Oyun yok' });
    const res = r.engine.act(r.players.findIndex(p => p.id === u.id), a || {}); if (res.error) return ack?.(res);
    push(r); ack?.({});
    if (r.engine.over && !r.saved) { r.saved = true; try { await store.record(r.game, r.players.map(p => ({ id: p.id, name: p.name })), r.engine.result()); } catch (e) { console.error('Geçmiş kaydedilemedi', e.message); } }
  });
  s.on('disconnect', () => {
    const n = (online.get(u.id) || 1) - 1; n ? online.set(u.id, n) : online.delete(u.id);
    const r = rooms.get(userRoom.get(u.id)); if (r) { const p = r.players.find(x => x.id === u.id); if (p && p.sid === s.id) { p.sid = null;
      if (!r.engine) leave(u.id); else { push(r); if (r.players.every(x => !x.sid)) setTimeout(() => { if (r.players.every(x => !x.sid)) { r.players.forEach(x => userRoom.delete(x.id)); rooms.delete(r.code); } }, 15 * 60e3); } } }
    bcastLobby();
  });
});
store.init().then(() => server.listen(process.env.PORT || 3000, '0.0.0.0', () => console.log('Sunucu hazır, port:', process.env.PORT || 3000))).catch(e => { console.error('Başlatılamadı:', e.message); process.exit(1); });
