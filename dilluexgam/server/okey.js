// 101 Okey kural motoru (sunucu tarafı). Taşlar yalnızca sunucuda karıştırılır/dağıtılır.
const { randomInt } = require('crypto');
const mk = () => { const t = []; let id = 0;
  for (let s = 0; s < 2; s++) for (let c = 0; c < 4; c++) for (let n = 1; n <= 13; n++) t.push({ id: id++, c, n });
  t.push({ id: id++, fake: true }, { id: id++, fake: true }); return t; };
const shuffle = a => { for (let i = a.length - 1; i > 0; i--) { const j = randomInt(i + 1); [a[i], a[j]] = [a[j], a[i]]; } return a; };
const resolve = (t, ok) => t.fake ? { c: ok.c, n: ok.n } : (t.c === ok.c && t.n === ok.n) ? { joker: true } : { c: t.c, n: t.n };

// Geçerli per/seri ise puan değerini, değilse 0 döner. Okey taşı joker, sahte okey okey'in yerini tutar.
function meldValue(tiles, ok) {
  const r = tiles.map(t => resolve(t, ok)), rs = r.filter(x => !x.joker), n = r.length;
  if (n < 3 || !rs.length) return 0;
  if (n <= 4 && rs.every(x => x.n === rs[0].n) && new Set(rs.map(x => x.c)).size === rs.length) return rs[0].n * n;
  if (n <= 13 && rs.every(x => x.c === rs[0].c)) {
    for (let s = 1; s + n - 1 <= 14; s++) {
      const used = new Set(); let good = true;
      for (const x of rs) { let p = null;
        for (const cand of x.n === 1 ? [1, 14] : [x.n]) if (cand >= s && cand < s + n && !used.has(cand)) { p = cand; break; }
        if (p === null) { good = false; break; } used.add(p); }
      if (good) { let v = 0; for (let p = s; p < s + n; p++) v += p === 14 ? 1 : p; return v; }
    }
  }
  return 0;
}
function pairOk(a, b, ok) { const x = resolve(a, ok), y = resolve(b, ok); return x.joker || y.joker || (x.c === y.c && x.n === y.n); }

class Okey {
  constructor(players) {
    this.players = players.map(p => ({ id: p.id, name: p.name, hand: [], opened: false, pairs: false, melds: [] }));
    const deck = shuffle(mk()); const i = deck.findIndex(t => !t.fake);
    this.indicator = deck.splice(i, 1)[0]; this.okey = { c: this.indicator.c, n: this.indicator.n % 13 + 1 };
    this.deck = deck;
    this.players.forEach((p, k) => { p.hand = this.deck.splice(0, k === 0 ? 22 : 21); });
    this.turn = 0; this.phase = 'discard'; this.last = null; this.lastBy = null; this.over = false; this.winner = null; this.scores = null;
  }
  act(pi, a) {
    if (this.over) return { error: 'Oyun bitti' };
    if (pi !== this.turn) return { error: 'Sıra sende değil' };
    const p = this.players[pi];
    if (a.type === 'draw') {
      if (this.phase !== 'draw') return { error: 'Şu an taş çekemezsin' };
      let t;
      if (a.from === 'discard') { if (!this.last || this.lastBy === pi) return { error: 'Yerde taş yok' }; t = this.last; this.last = null; }
      else { if (!this.deck.length) { this.finish(null); return {}; } t = this.deck.pop(); }
      p.hand.push(t); this.phase = 'discard'; return {};
    }
    if (this.phase !== 'discard') return { error: 'Önce taş çekmelisin' };
    if (a.type === 'open') {
      const ids = (a.groups || []).flat();
      if (!ids.length || new Set(ids).size !== ids.length) return { error: 'Geçersiz taş seçimi' };
      const byId = new Map(p.hand.map(t => [t.id, t]));
      if (!ids.every(id => byId.has(id))) return { error: 'Bu taşlar elinde yok' };
      const groups = a.groups.map(g => g.map(id => byId.get(id)));
      if (a.pairs || p.pairs) {
        if (p.opened && !p.pairs) return { error: 'Seri açtın, çift açamazsın' };
        if (!groups.every(g => g.length === 2 && pairOk(g[0], g[1], this.okey))) return { error: 'Çiftler geçersiz' };
        if (!p.opened && groups.length < 5) return { error: 'Çift açmak için en az 5 çift gerekir' };
        p.pairs = true;
      } else {
        const vals = groups.map(g => meldValue(g, this.okey));
        if (vals.some(v => !v)) return { error: 'Geçersiz per/seri var' };
        if (!p.opened && vals.reduce((x, y) => x + y, 0) < 101) return { error: 'Açmak için toplam en az 101 gerekir' };
      }
      p.hand = p.hand.filter(t => !ids.includes(t.id)); p.melds.push(...groups); p.opened = true;
      if (!p.hand.length) this.finish(pi);
      return {};
    }
    if (a.type === 'discard') {
      const k = p.hand.findIndex(t => t.id === a.id); if (k < 0) return { error: 'Bu taş elinde yok' };
      const [t] = p.hand.splice(k, 1); this.last = t; this.lastBy = pi;
      if (!p.hand.length) { this.finish(pi); return {}; }
      this.turn = (pi + 1) % this.players.length; this.phase = 'draw'; return {};
    }
    return { error: 'Bilinmeyen hamle' };
  }
  finish(w) {
    this.over = true; this.winner = w;
    const mult = w !== null && this.players[w].pairs ? 2 : 1;
    this.scores = this.players.map((p, i) => i === w ? 0 : mult * (!p.opened ? 202 :
      p.hand.reduce((s, t) => { const r = resolve(t, this.okey); return s + (r.joker ? 0 : r.n); }, 0)));
  }
  result() { return { winner: this.winner === null ? null : this.players[this.winner].id, scores: this.scores }; }
  view(pi) {
    return { game: 'okey', you: pi, indicator: this.indicator, okey: this.okey, deck: this.deck.length, turn: this.turn, phase: this.phase,
      last: this.last, lastBy: this.lastBy, hand: this.players[pi].hand, over: this.over, winner: this.winner, scores: this.scores,
      players: this.players.map(p => ({ name: p.name, count: p.hand.length, opened: p.opened, pairs: p.pairs, melds: p.melds })) };
  }
}
module.exports = { Okey, meldValue, pairOk, mk };
