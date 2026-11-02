// PostgreSQL deposu. DATABASE_URL yoksa yalnızca geliştirme için bellek içi depo kullanılır.
const fs = require('fs'), path = require('path');
let pool = null; const mem = { users: [], hist: [] };
const level = u => 1 + Math.floor((u.games + u.wins * 2) / 5);
const pub = u => u && { id: u.id, username: u.username, avatar: u.avatar, games: u.games, wins: u.wins, level: level(u) };
async function init() {
  if (!process.env.DATABASE_URL) { console.warn('UYARI: DATABASE_URL yok → bellek içi depo. Sunucu yeniden başlayınca hesaplar silinir.'); return; }
  const { Pool } = require('pg');
  pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: process.env.PGSSL === '1' ? { rejectUnauthorized: false } : undefined });
  await pool.query(fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8'));
}
const AV = ['#ff5d73', '#2bd9ff', '#ffc933', '#b6f23c', '#a78bfa', '#ff8a3d'];
async function createUser(username, email, hash) {
  const avatar = AV[Math.floor(Math.random() * AV.length)];
  if (!pool) { if (mem.users.some(u => u.email === email || u.username.toLowerCase() === username.toLowerCase())) throw { code: '23505' };
    const u = { id: mem.users.length + 1, username, email, pass_hash: hash, avatar, games: 0, wins: 0 }; mem.users.push(u); return u; }
  return (await pool.query('INSERT INTO users(username,email,pass_hash,avatar) VALUES($1,$2,$3,$4) RETURNING *', [username, email, hash, avatar])).rows[0];
}
async function byEmail(e) { return pool ? (await pool.query('SELECT * FROM users WHERE email=$1', [e])).rows[0] : mem.users.find(u => u.email === e); }
async function byId(id) { return pool ? (await pool.query('SELECT * FROM users WHERE id=$1', [id])).rows[0] : mem.users.find(u => u.id === id); }
async function record(game, players, result) {
  const won = result.winner;
  if (!pool) { mem.hist.push({ game, players, result, created_at: new Date() }); players.forEach(p => { const u = mem.users.find(x => x.id === p.id); if (u) { u.games++; if (p.id === won) u.wins++; } }); return; }
  await pool.query('INSERT INTO history(game,players,result) VALUES($1,$2,$3)', [game, JSON.stringify(players), JSON.stringify(result)]);
  await pool.query('UPDATE users SET games=games+1, wins=wins+(CASE WHEN id=$2 THEN 1 ELSE 0 END) WHERE id = ANY($1)', [players.map(p => p.id), won ?? -1]);
}
async function history(uid) {
  if (!pool) return mem.hist.filter(h => h.players.some(p => p.id === uid)).slice(-20).reverse();
  return (await pool.query('SELECT game,players,result,created_at FROM history WHERE players @> $1::jsonb ORDER BY id DESC LIMIT 20', [JSON.stringify([{ id: uid }])])).rows;
}
module.exports = { init, createUser, byEmail, byId, record, history, pub };
