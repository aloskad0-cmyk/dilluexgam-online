// Monopoly kural motoru (sunucu tarafı). Zarlar sunucuda atılır; istemci yalnızca istek gönderir.
const { randomInt } = require('crypto');
const GROUPS = {
  brown: [50, [[60, '2,10,30,90,160,250', 'Kars'], [60, '4,20,60,180,320,450', 'Van']]],
  lb: [50, [[100, '6,30,90,270,400,550', 'Tokat'], [100, '6,30,90,270,400,550', 'Sinop'], [120, '8,40,100,300,450,600', 'Rize']]],
  pink: [100, [[140, '10,50,150,450,625,750', 'Bolu'], [140, '10,50,150,450,625,750', 'Konya'], [160, '12,60,180,500,700,900', 'Bursa']]],
  or: [100, [[180, '14,70,200,550,750,950', 'Adana'], [180, '14,70,200,550,750,950', 'Antalya'], [200, '16,80,220,600,800,1000', 'Mersin']]],
  red: [150, [[220, '18,90,250,700,875,1050', 'Samsun'], [220, '18,90,250,700,875,1050', 'Eskişehir'], [240, '20,100,300,750,925,1100', 'Trabzon']]],
  ye: [150, [[260, '22,110,330,800,975,1150', 'Gaziantep'], [260, '22,110,330,800,975,1150', 'Kayseri'], [280, '24,120,360,850,1025,1200', 'Mardin']]],
  gr: [200, [[300, '26,130,390,900,1100,1275', 'Çeşme'], [300, '26,130,390,900,1100,1275', 'Bodrum'], [320, '28,150,450,1000,1200,1400', 'Ankara']]],
  bl: [200, [[350, '35,175,500,1100,1300,1500', 'İzmir'], [400, '50,200,600,1400,1700,2000', 'İstanbul']]],
};
const POS = { 1: ['brown', 0], 3: ['brown', 1], 6: ['lb', 0], 8: ['lb', 1], 9: ['lb', 2], 11: ['pink', 0], 13: ['pink', 1], 14: ['pink', 2],
  16: ['or', 0], 18: ['or', 1], 19: ['or', 2], 21: ['red', 0], 23: ['red', 1], 24: ['red', 2], 26: ['ye', 0], 27: ['ye', 1], 29: ['ye', 2],
  31: ['gr', 0], 32: ['gr', 1], 34: ['gr', 2], 37: ['bl', 0], 39: ['bl', 1] };
const BOARD = Array.from({ length: 40 }, (_, i) => ({ i, type: 'misc', name: '' }));
for (const [i, [g, k]] of Object.entries(POS)) { const [hc, list] = GROUPS[g]; const [price, rents, name] = list[k];
  BOARD[i] = { i: +i, type: 'prop', name, group: g, price, rents: rents.split(',').map(Number), hc }; }
Object.assign(BOARD[0], { name: 'Başlangıç', type: 'go' }); Object.assign(BOARD[10], { name: 'Hapis', type: 'jail' });
Object.assign(BOARD[20], { name: 'Serbest Park', type: 'park' }); Object.assign(BOARD[30], { name: 'Hapse Git', type: 'gojail' });
Object.assign(BOARD[4], { name: 'Gelir Vergisi', type: 'tax', amount: 200 }); Object.assign(BOARD[38], { name: 'Lüks Vergisi', type: 'tax', amount: 100 });
[7, 22, 36].forEach(i => Object.assign(BOARD[i], { name: 'Şans', type: 'card' })); [2, 17, 33].forEach(i => Object.assign(BOARD[i], { name: 'Kamu Fonu', type: 'card' }));
[[5, 'Haydarpaşa'], [15, 'Sirkeci'], [25, 'Ankara Garı'], [35, 'Basmane']].forEach(([i, n]) => Object.assign(BOARD[i], { name: n, type: 'rr', price: 200 }));
[[12, 'Elektrik'], [28, 'Su İdaresi']].forEach(([i, n]) => Object.assign(BOARD[i], { name: n, type: 'util', price: 150 }));
const CARDS = [{ s: 'Hisse senedi temettüsü +100', m: 100 }, { s: 'Piyangodan +50', m: 50 }, { s: 'Miras +200', m: 200 },
  { s: 'Bina tamiri -50', m: -50 }, { s: 'Trafik cezası -100', m: -100 }, { s: 'Doktor masrafı -150', m: -150 },
  { s: 'Hapse git!', jail: true }, { s: 'Başlangıca git (+200)', go: 1 }];

class Monopoly {
  constructor(pl) {
    this.players = pl.map(p => ({ id: p.id, name: p.name, pos: 0, cash: 1500, jail: 0, out: false }));
    this.owner = {}; this.turn = 0; this.phase = 'roll'; this.dice = [0, 0]; this.doubles = 0; this.extra = false;
    this.auction = null; this.log = ['Oyun başladı']; this.over = false; this.winner = null;
  }
  get cur() { return this.players[this.turn]; }
  L(s) { this.log.push(s); if (this.log.length > 30) this.log.shift(); }
  owns(pi, g) { return BOARD.filter(t => t.group === g).every(t => this.owner[t.i]?.p === pi); }
  count(pi, type) { return BOARD.filter(t => t.type === type && this.owner[t.i]?.p === pi).length; }
  next() { do { this.turn = (this.turn + 1) % this.players.length; } while (this.cur.out); this.phase = 'roll'; this.doubles = 0; this.extra = false; }
  rent(pos, o) {
    const t = BOARD[pos];
    if (t.type === 'rr') return 25 * 2 ** (this.count(o.p, 'rr') - 1);
    if (t.type === 'util') return (this.dice[0] + this.dice[1]) * (this.count(o.p, 'util') === 2 ? 10 : 4);
    return t.rents[o.h] * (o.h === 0 && this.owns(o.p, t.group) ? 2 : 1);
  }
  pay(p, amt, to) {
    if (p.cash >= amt) { p.cash -= amt; if (to) to.cash += amt; return; }
    const ti = to ? this.players.indexOf(to) : -1;
    if (to) to.cash += p.cash; p.cash = 0; p.out = true; this.L(p.name + ' iflas etti');
    for (const [pos, o] of Object.entries(this.owner)) if (o.p === this.players.indexOf(p)) { if (ti >= 0) this.owner[pos] = { p: ti, h: 0 }; else delete this.owner[pos]; }
    const alive = this.players.filter(x => !x.out);
    if (alive.length === 1) { this.over = true; this.winner = this.players.indexOf(alive[0]); this.L(alive[0].name + ' kazandı!'); }
    else if (this.cur === p) this.next();
  }
  jail(p) { p.pos = 10; p.jail = 1; this.extra = false; this.phase = 'end'; this.L(p.name + ' hapse girdi'); }
  move(p, steps) {
    if (p.pos + steps >= 40) { p.cash += 200; this.L(p.name + ' başlangıçtan geçti +200'); }
    p.pos = (p.pos + steps) % 40; this.land(p);
  }
  land(p) {
    const t = BOARD[p.pos]; this.phase = 'end';
    if (['prop', 'rr', 'util'].includes(t.type)) {
      const o = this.owner[p.pos];
      if (!o) { this.phase = 'buy'; return; }
      if (o.p !== this.players.indexOf(p)) { const r = this.rent(p.pos, o); this.L(`${p.name} → ${this.players[o.p].name}: ${r} kira`); this.pay(p, r, this.players[o.p]); }
    } else if (t.type === 'tax') this.pay(p, t.amount, null);
    else if (t.type === 'gojail') this.jail(p);
    else if (t.type === 'card') {
      const c = CARDS[randomInt(CARDS.length)]; this.L(`${t.name}: ${c.s}`);
      if (c.m > 0) p.cash += c.m; else if (c.m < 0) this.pay(p, -c.m, null); else if (c.jail) this.jail(p); else if (c.go) { p.pos = 0; p.cash += 200; }
    }
  }
  act(pi, a) {
    if (this.over) return { error: 'Oyun bitti' };
    if (this.auction && (a.type === 'bid' || a.type === 'pass')) return this.auct(pi, a);
    if (pi !== this.turn) return { error: 'Sıra sende değil' };
    if (this.auction) return { error: 'Açık artırma sürüyor' };
    const p = this.cur, no = m => ({ error: m });
    switch (a.type) {
      case 'roll': {
        if (this.phase !== 'roll') return no('Şu an zar atamazsın');
        const d = [randomInt(1, 7), randomInt(1, 7)], dbl = d[0] === d[1], s = d[0] + d[1]; this.dice = d; this.L(`${p.name} ${d[0]}+${d[1]} attı`);
        if (p.jail) {
          if (dbl) { p.jail = 0; this.move(p, s); }
          else if (++p.jail > 3) { p.jail = 0; this.pay(p, 50, null); if (!p.out) this.move(p, s); }
          else this.phase = 'end';
          return {};
        }
        if (dbl && ++this.doubles === 3) { this.jail(p); return {}; }
        this.extra = dbl; this.move(p, s); return {};
      }
      case 'payJail': if (this.phase !== 'roll' || !p.jail || p.cash < 50) return no('Yapılamaz'); p.cash -= 50; p.jail = 0; return {};
      case 'buy': { const t = BOARD[p.pos];
        if (this.phase !== 'buy' || p.cash < t.price) return no('Satın alınamaz'); p.cash -= t.price; this.owner[p.pos] = { p: pi, h: 0 }; this.L(`${p.name} ${t.name} aldı`); this.phase = 'end'; return {}; }
      case 'decline': if (this.phase !== 'buy') return no('Yapılamaz');
        this.auction = { pos: p.pos, bid: 0, bidder: null, cur: 0, order: this.players.map((x, i) => i).filter(i => !this.players[i].out) };
        this.phase = 'auction'; this.L(BOARD[p.pos].name + ' açık artırmada'); return {};
      case 'build': { const t = BOARD[a.pos], o = this.owner[a.pos];
        if (!t || t.type !== 'prop' || o?.p !== pi || !this.owns(pi, t.group) || !['roll', 'end'].includes(this.phase)) return no('Bina yapılamaz');
        const mn = Math.min(...BOARD.filter(x => x.group === t.group).map(x => this.owner[x.i].h));
        if (o.h >= 5 || o.h > mn || p.cash < t.hc) return no('Bina yapılamaz (eşit dağıt / para yetersiz)');
        p.cash -= t.hc; o.h++; this.L(`${p.name} ${t.name} üstüne ${o.h === 5 ? 'otel' : 'ev'} yaptı`); return {}; }
      case 'endTurn': if (this.phase !== 'end') return no('Turu şimdi bitiremezsin');
        if (this.extra && !p.jail) { this.phase = 'roll'; this.extra = false; } else this.next(); return {};
    }
    return no('Bilinmeyen hamle');
  }
  auct(pi, a) {
    const A = this.auction; if (A.order[A.cur] !== pi) return { error: 'Teklif sırası sende değil' };
    if (a.type === 'bid') { const m = Math.floor(a.amount);
      if (!(m > A.bid) || m > this.players[pi].cash) return { error: 'Geçersiz teklif' };
      A.bid = m; A.bidder = pi; A.cur = (A.cur + 1) % A.order.length;
    } else { A.order.splice(A.cur, 1); if (A.cur >= A.order.length) A.cur = 0; }
    if (A.order.length === 1 && A.bidder === A.order[0]) {
      const w = this.players[A.bidder]; w.cash -= A.bid; this.owner[A.pos] = { p: A.bidder, h: 0 }; this.L(`${w.name} ${BOARD[A.pos].name} mülkünü ${A.bid} ödeyip aldı`); this.auction = null; this.phase = 'end';
    } else if (!A.order.length) { this.auction = null; this.phase = 'end'; this.L('Kimse teklif vermedi'); }
    return {};
  }
  result() { return { winner: this.winner === null ? null : this.players[this.winner].id }; }
  view(pi) {
    const A = this.auction;
    return { game: 'monopoly', you: pi, players: this.players, owner: this.owner, turn: this.turn, phase: this.phase, dice: this.dice, log: this.log,
      auction: A && { pos: A.pos, bid: A.bid, bidder: A.bidder, cur: A.order[A.cur] }, over: this.over, winner: this.winner };
  }
}
module.exports = { Monopoly, BOARD };
