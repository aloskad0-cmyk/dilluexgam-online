const $ = s => document.querySelector(s), $$ = s => [...document.querySelectorAll(s)], esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
let token = localStorage.getItem('tok'), me = null, sock = null, R = null, fxOn = localStorage.getItem('fx') !== '0', order = [], sel = new Set(), groups = [], mode = 'bg', board = null;
const api = async (p, b, m) => { const r = await fetch(p, { method: b ? 'POST' : 'GET', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token }, body: b && JSON.stringify(b) }); const j = await r.json(); if (!r.ok) throw new Error(j.error || 'Hata'); return j; };
const show = id => { $$('.screen').forEach(e => e.classList.add('hidden')); $('#' + id).classList.remove('hidden'); mode = id === 'room' && R?.started && R.game === 'monopoly' ? 'board' : 'bg'; };
/* ---- Giriş ---- */
async function auth(kind) { try { const j = await api('/api/' + kind, { username: $('#a-user').value, email: $('#a-mail').value, password: $('#a-pass').value }); token = j.token; localStorage.setItem('tok', token); me = j.user; connect(); } catch (e) { $('#a-err').textContent = e.message; } }
$('#a-login').onclick = () => auth('login'); $('#a-reg').onclick = () => auth('register');
async function boot() { if (!token) return show('auth'); try { me = (await api('/api/me')).user; connect(); } catch { localStorage.removeItem('tok'); show('auth'); } }
function connect() {
  sock = io({ auth: { token } }); sock.on('connect_error', () => { localStorage.removeItem('tok'); show('auth'); });
  sock.on('connect', () => { $('#m-me').textContent = `${me.username} · Seviye ${me.level}`; if (!R) show('menu'); });
  sock.on('online', n => { $('#m-online').textContent = $('#l-online').textContent = `● ${n} çevrimiçi`; });
  sock.on('rooms', list => { $('#l-list').innerHTML = list.length ? list.map(r => `<div class="rl"><span>${r.game === 'okey' ? '101 Okey' : 'Monopoly'} · ${esc(r.host)} · ${r.n}/${r.max}</span><button class="b lime" data-j="${r.code}">Katıl</button></div>`).join('') : '<p>Şu an açık oda yok — bir tane kur!</p>'; });
  sock.on('room', s => { R = s; render(); });
}
/* ---- Menü / Lobi ---- */
const join = c => sock.emit('room:join', { code: c }, r => r?.error && ($('#l-err').textContent = r.error));
document.addEventListener('click', async e => {
  const g = e.target.dataset?.go, j = e.target.dataset?.j; if (j) return join(j); if (!g) return;
  $('#m-panel').classList.add('hidden');
  if (['okey', 'monopoly', 'lobby'].includes(g)) return show('lobby');
  if (g === 'menu') return show('menu'); const P = $('#m-panel'); P.classList.remove('hidden');
  if (g === 'friends') P.innerHTML = '<h3>Arkadaşlar</h3><p>Arkadaş listesi bu sürümde henüz yok. Arkadaşlarını oda koduyla davet edebilirsin.</p>';
  if (g === 'settings') { P.innerHTML = `<h3>Ayarlar</h3><label><input type="checkbox" id="fx" ${fxOn ? 'checked' : ''}> 3D arka plan animasyonu</label>`; $('#fx').onchange = ev => { fxOn = ev.target.checked; localStorage.setItem('fx', fxOn ? 1 : 0); }; }
  if (g === 'profile') { const j2 = await api('/api/me'), u = j2.user; me = u; P.innerHTML = `<h3>${esc(u.username)}</h3><p>Seviye ${u.level} · ${u.games} oyun · ${u.wins} galibiyet</p>` + j2.history.map(h => `<div class="rl"><span>${h.game === 'okey' ? '101 Okey' : 'Monopoly'}</span><span>${new Date(h.created_at).toLocaleDateString('tr')}</span></div>`).join(''); }
});
const create = game => sock.emit('room:create', { game, priv: $('#c-priv').checked }, r => r?.error && ($('#l-err').textContent = r.error));
$('#c-okey').onclick = () => create('okey'); $('#c-mono').onclick = () => create('monopoly'); $('#j-go').onclick = () => join($('#j-code').value);
/* ---- Oda ---- */
function render() {
  if (!R) return show('menu'); show('room'); const w = $('#r-wait'), g = $('#r-game');
  if (!R.started) { g.classList.add('hidden'); w.classList.remove('hidden'); const host = R.host === me.id;
    w.innerHTML = `<h2>${R.game === 'okey' ? '101 Okey' : 'Monopoly'} · Oda <b>${R.code}</b> ${R.priv ? '(özel)' : ''}</h2>` + R.players.map(p => `<div class="rl"><span><span class="dot ${p.connected ? 'on' : ''}"></span>${esc(p.name)}</span></div>`).join('') +
      `<div class="row" style="margin-top:12px">${host ? '<button class="b lime" id="st">Oyunu başlat</button>' : '<span>Oda sahibi başlatınca oyun açılır…</span>'}<button class="b ghost" id="lv">Odadan çık</button></div><p class="err" id="r-err"></p>`;
    $('#lv').onclick = () => { sock.emit('room:leave'); R = null; render(); }; if (host) $('#st').onclick = () => sock.emit('room:start', {}, r => r?.error && ($('#r-err').textContent = r.error)); return; }
  w.classList.add('hidden'); g.classList.remove('hidden'); mode = R.game === 'monopoly' ? 'board' : 'bg'; R.game === 'okey' ? okeyUI(g, R.state) : monoUI(g, R.state);
}
const act = a => sock.emit('game:act', a, r => r?.error && alert(r.error));
function tileEl(t, o) { const j = !t.fake && t.c === o.c && t.n === o.n; return `<div class="tile ${t.fake ? 'c3' : 'c' + t.c} ${j ? 'j' : ''}" draggable="true" data-id="${t.id}">${t.fake ? '★' : t.n}<small>${t.fake ? 'sahte' : j ? 'okey' : ''}</small></div>`; }
function okeyUI(g, s) {
  order = order.filter(id => s.hand.some(t => t.id === id)); s.hand.forEach(t => { if (!order.includes(t.id)) order.push(t.id); }); sel = new Set([...sel].filter(id => order.includes(id)));
  const mine = s.turn === s.you, byId = id => s.hand.find(t => t.id === id), ind = s.indicator, last = s.last;
  g.innerHTML = `<div class="panel row"><span>Gösterge: <span class="tile c${ind.c}" style="display:inline-flex">${ind.n}</span></span><span>Deste: ${s.deck}</span><span>${s.over ? 'Oyun bitti' : mine ? '<b>Sıra sende — ' + (s.phase === 'draw' ? 'taş çek' : 'taş at / aç') + '</b>' : esc(s.players[s.turn].name) + ' oynuyor'}</span></div>` +
    (s.over ? `<div class="panel"><h3>Sonuç</h3>${s.players.map((p, i) => `<div class="rl"><span>${esc(p.name)} ${i === s.winner ? '🏆' : ''}</span><span>${s.scores[i]} ceza puanı</span></div>`).join('')}<button class="b ghost" id="bye">Menüye dön</button></div>` : '') +
    `<div class="panel">${s.players.map((p, i) => `<div class="pl ${i === s.turn ? 'turn' : ''}"><span>${esc(p.name)}${i === s.you ? ' (sen)' : ''}</span><span>${p.count} taş ${p.opened ? '· açtı' : ''}</span></div><div class="melds">${p.melds.map(m => `<div class="rack">${m.map(t => tileEl(t, s.okey).replace('draggable="true"', '')).join('')}</div>`).join('')}</div>`).join('')}</div>` +
    `<div class="panel row"><button class="b cyan" id="dk" ${mine && s.phase === 'draw' ? '' : 'disabled'}>Desteden çek</button><button class="b cyan" id="dc" ${mine && s.phase === 'draw' && last && s.lastBy !== s.you ? '' : 'disabled'}>Yerden al ${last ? `(${last.fake ? '★' : last.n})` : ''}</button></div>` +
    `<div class="panel"><div class="rack" id="rack">${order.map(id => tileEl(byId(id), s.okey).replace('class="tile', sel.has(id) ? 'class="tile sel' : 'class="tile')).join('')}</div></div>` +
    `<div class="panel"><div class="row"><button class="b lime" id="mk">Seçileni grup yap</button><button class="b sun" id="op" ${mine && s.phase === 'discard' ? '' : 'disabled'}>Aç / Grupları indir</button><label><input type="checkbox" id="pr"> Çift aç</label><button class="b coral" id="ds" ${mine && s.phase === 'discard' ? '' : 'disabled'}>Seçili taşı at</button></div><div class="log">Hazır gruplar: ${groups.map(x => x.length + ' taş').join(', ') || '—'} <button class="b ghost" id="cl">Temizle</button></div></div>`;
  const rack = $('#rack'); let drag = null;
  rack.onclick = e => { const t = e.target.closest('.tile'); if (!t) return; const id = +t.dataset.id; sel.has(id) ? sel.delete(id) : sel.add(id); okeyUI(g, s); };
  rack.ondragstart = e => { drag = +e.target.closest('.tile')?.dataset.id; }; rack.ondragover = e => e.preventDefault();
  rack.ondrop = e => { const to = +e.target.closest('.tile')?.dataset.id; if (drag == null || isNaN(to) || drag === to) return; order.splice(order.indexOf(drag), 1); order.splice(order.indexOf(to), 0, drag); okeyUI(g, s); };
  $('#dk').onclick = () => act({ type: 'draw', from: 'deck' }); $('#dc').onclick = () => act({ type: 'draw', from: 'discard' });
  $('#mk').onclick = () => { if (sel.size) { groups.push([...sel]); sel.clear(); okeyUI(g, s); } }; $('#cl').onclick = () => { groups = []; okeyUI(g, s); };
  $('#op').onclick = () => { act({ type: 'open', groups, pairs: $('#pr').checked }); groups = []; };
  $('#ds').onclick = () => { if (sel.size === 1) { act({ type: 'discard', id: [...sel][0] }); sel.clear(); } else alert('Atmak için tek taş seç'); };
  $('#bye')?.addEventListener('click', () => { sock.emit('room:leave'); R = null; render(); });
}
/* ---- Monopoly arayüzü ---- */
const GC = { brown: '#8b4a2b', lb: '#7fd6ff', pink: '#ff66c4', or: '#ff9a2e', red: '#ff3b3b', ye: '#ffd93b', gr: '#2fcf6b', bl: '#3b5bff' }, PC = ['#ff5d73', '#2bd9ff', '#ffc933', '#b6f23c'];
function monoUI(g, s) {
  const p = s.players, me_ = s.you, mine = s.turn === me_, A = s.auction, t = board && board[p[me_].pos];
  const buildable = board ? board.filter(x => x.type === 'prop' && s.owner[x.i]?.p === me_ && board.filter(y => y.group === x.group).every(y => s.owner[y.i]?.p === me_)) : [];
  g.innerHTML = `<div class="board-hud panel"><h3>${s.over ? '🏆 ' + esc(p[s.winner].name) + ' kazandı' : mine ? 'Sıra sende' : esc(p[s.turn].name) + ' oynuyor'} · 🎲 ${s.dice[0]}+${s.dice[1]}</h3>` +
    p.map((x, i) => `<div class="pl ${i === s.turn ? 'turn' : ''}" style="background:${PC[i]}33"><span>${esc(x.name)}${x.jail ? ' ⛓' : ''}${x.out ? ' ✖' : ''}</span><b>₺${x.cash}</b></div>`).join('') +
    (A ? `<div class="panel"><b>Açık artırma: ${board?.[A.pos].name}</b><br>En yüksek: ₺${A.bid} ${A.bidder != null ? '(' + esc(p[A.bidder].name) + ')' : ''}<br>${A.cur === me_ ? `<div class="row"><button class="b lime" id="bd">+10 ver</button><button class="b ghost" id="ps">Pas</button></div>` : esc(p[A.cur].name) + ' karar veriyor'}</div>` : '') +
    (mine && !s.over && !A ? `<div class="row" style="margin:8px 0">${s.phase === 'roll' ? `<button class="b lime" id="rl">Zar at</button>${p[me_].jail ? '<button class="b sun" id="pj">₺50 öde, çık</button>' : ''}` : ''}${s.phase === 'buy' ? `<button class="b lime" id="by">Satın al ₺${t?.price}</button><button class="b ghost" id="dn">Açık artırma</button>` : ''}${s.phase === 'end' ? '<button class="b cyan" id="et">Turu bitir</button>' : ''}</div>` +
      (['roll', 'end'].includes(s.phase) && buildable.length ? `<div class="row">${buildable.map(x => `<button class="b ghost" data-b="${x.i}" style="border-bottom:4px solid ${GC[x.group]}">${x.name} 🏠${s.owner[x.i].h}/5 (₺${x.hc})</button>`).join('')}</div>` : '') : '') +
    `<div class="log">${s.log.slice().reverse().map(esc).join('<br>')}</div>${s.over ? '<button class="b ghost" id="bye">Menüye dön</button>' : ''}</div>`;
  const on = (id, f) => $(id) && ($(id).onclick = f); on('#rl', () => act({ type: 'roll' })); on('#pj', () => act({ type: 'payJail' })); on('#by', () => act({ type: 'buy' })); on('#dn', () => act({ type: 'decline' })); on('#et', () => act({ type: 'endTurn' }));
  on('#bd', () => act({ type: 'bid', amount: A.bid + 10 })); on('#ps', () => act({ type: 'pass' })); on('#bye', () => { sock.emit('room:leave'); R = null; render(); });
  $$('[data-b]').forEach(b => b.onclick = () => act({ type: 'build', pos: +b.dataset.b })); syncBoard(s);
}
/* ---- Three.js: hareketli menü arka planı + 3D Monopoly tahtası ---- */
const cv = $('#gl'), rd = new THREE.WebGLRenderer({ canvas: cv, antialias: true }); rd.setPixelRatio(Math.min(devicePixelRatio, 2));
const bgS = new THREE.Scene(), bgC = new THREE.PerspectiveCamera(60, 1, .1, 100), bS = new THREE.Scene(), bC = new THREE.PerspectiveCamera(45, 1, .1, 100), S = 1.2, bg = [];
bgS.background = new THREE.Color(0x14123a); bgS.add(new THREE.AmbientLight(0xffffff, .7)); const dl = new THREE.DirectionalLight(0xffffff, .9); dl.position.set(5, 10, 7); bgS.add(dl); bgC.position.z = 14;
[0xff5d73, 0x2bd9ff, 0xffc933, 0xb6f23c, 0xa78bfa].forEach((c, k) => { for (let i = 0; i < 9; i++) { const m = new THREE.Mesh(k % 2 ? new THREE.BoxGeometry(1, 1.4, .35) : new THREE.BoxGeometry(1, 1, 1), new THREE.MeshStandardMaterial({ color: c, roughness: .4 }));
  m.position.set((Math.random() - .5) * 26, (Math.random() - .5) * 16, (Math.random() - .5) * 8 - 2); m.userData = { r: [Math.random() * .01 + .003, Math.random() * .01 + .003], f: Math.random() * 6 }; bgS.add(m); bg.push(m); } });
bS.background = new THREE.Color(0x1a1650); bS.add(new THREE.AmbientLight(0xffffff, .75)); const bl = new THREE.DirectionalLight(0xffffff, .9); bl.position.set(8, 14, 12); bS.add(bl);
const tp = i => i <= 10 ? [10 - i, 10] : i <= 20 ? [0, 20 - i] : i <= 30 ? [i - 20, 0] : [10, i - 30], dyn = new THREE.Group(), pawns = []; bS.add(dyn);
async function buildBoard() {
  board = await (await fetch('/api/board')).json(); const base = new THREE.Mesh(new THREE.BoxGeometry(11 * S + .6, .3, 11 * S + .6), new THREE.MeshStandardMaterial({ color: 0x0f7a4f })); base.position.set(5 * S, -.2, 5 * S); bS.add(base);
  board.forEach(t => { const [x, z] = tp(t.i), c = document.createElement('canvas'); c.width = c.height = 128; const k = c.getContext('2d'); k.fillStyle = '#f6efd8'; k.fillRect(0, 0, 128, 128);
    if (t.group) { k.fillStyle = GC[t.group]; k.fillRect(0, 0, 128, 34); } else if (['rr', 'util'].includes(t.type)) { k.fillStyle = '#555'; k.fillRect(0, 0, 128, 34); }
    k.fillStyle = '#111'; k.font = 'bold 17px Fredoka,sans-serif'; k.textAlign = 'center'; k.fillText(t.name, 64, 66); if (t.price) k.fillText('₺' + t.price, 64, 100);
    const m = new THREE.Mesh(new THREE.BoxGeometry(S * .96, .12, S * .96), [0, 1, 2, 3, 4, 5].map(f => f === 2 ? new THREE.MeshStandardMaterial({ map: new THREE.CanvasTexture(c) }) : new THREE.MeshStandardMaterial({ color: 0xd9cfae }))); m.position.set(x * S, 0, z * S); bS.add(m); });
  for (let i = 0; i < 4; i++) { const m = new THREE.Mesh(new THREE.CylinderGeometry(.18, .26, .6, 20), new THREE.MeshStandardMaterial({ color: PC[i] })); m.visible = false; m.userData = { t: new THREE.Vector3() }; bS.add(m); pawns.push(m); }
  bC.position.set(5 * S, 13, 5 * S + 11); bC.lookAt(5 * S, 0, 5 * S + 1); if (R?.state) syncBoard(R.state);
}
buildBoard();
function syncBoard(s) {
  if (!board) return; dyn.clear();
  Object.entries(s.owner).forEach(([pos, o]) => { const [x, z] = tp(+pos), b = new THREE.Mesh(new THREE.BoxGeometry(S * .9, .1, .16), new THREE.MeshStandardMaterial({ color: PC[o.p] })); b.position.set(x * S, .12, z * S + S * .38); dyn.add(b);
    for (let h = 0; h < o.h; h++) { const hb = new THREE.Mesh(new THREE.BoxGeometry(.18, o.h === 5 ? .35 : .2, .18), new THREE.MeshStandardMaterial({ color: o.h === 5 ? 0xff2d2d : 0x2fcf6b })); hb.position.set(x * S - S * .36 + (o.h === 5 ? 3 : h) * .2, .25, z * S - S * .25); dyn.add(hb); } });
  s.players.forEach((p, i) => { const m = pawns[i]; if (!m) return; const [x, z] = tp(p.pos); m.visible = !p.out; m.userData.t.set(x * S + (i % 2 ? .22 : -.22), .4, z * S + (i > 1 ? .22 : -.22)); if (!m.userData.init) { m.position.copy(m.userData.t); m.userData.init = 1; } });
}
function size() { const w = innerWidth, h = innerHeight; rd.setSize(w, h, false); bgC.aspect = bC.aspect = w / h; bgC.updateProjectionMatrix(); bC.updateProjectionMatrix(); } addEventListener('resize', size); size();
(function loop(t) { requestAnimationFrame(loop);
  if (mode === 'board') { pawns.forEach(m => { const d = m.position.distanceTo(m.userData.t); m.position.lerp(m.userData.t, .12); m.position.y = .4 + Math.min(d, 1) * .5; }); rd.render(bS, bC); }
  else { if (fxOn) bg.forEach(m => { m.rotation.x += m.userData.r[0]; m.rotation.y += m.userData.r[1]; m.position.y += Math.sin(t / 1000 + m.userData.f) * .002; }); rd.render(bgS, bgC); } })(0);
boot();
