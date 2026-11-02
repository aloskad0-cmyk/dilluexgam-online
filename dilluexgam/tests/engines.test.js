const assert = require('assert'); const { Okey, meldValue } = require('../server/okey'); const { Monopoly } = require('../server/monopoly');
const ok = { c: 0, n: 7 }; const T = (id, c, n, fake) => fake ? { id, fake: true } : { id, c, n };
assert.strictEqual(meldValue([T(1, 1, 4), T(2, 1, 5), T(3, 1, 6)], ok), 15);
assert.strictEqual(meldValue([T(1, 1, 12), T(2, 1, 13), T(3, 1, 1)], ok), 26);
assert.strictEqual(meldValue([T(1, 1, 13), T(2, 1, 1), T(3, 1, 2)], ok), 0);
assert.strictEqual(meldValue([T(1, 1, 9), T(2, 2, 9), T(3, 3, 9)], ok), 27);
assert.strictEqual(meldValue([T(1, 1, 9), T(2, 1, 9), T(3, 3, 9)], ok), 0);
assert.strictEqual(meldValue([T(1, 1, 4), T(2, 0, 7), T(3, 1, 6)], ok), 15);
assert.strictEqual(meldValue([T(1, 1, 4), T(2, 0, 0, true), T(3, 1, 6)], ok), 0);
for (let g = 0; g < 50; g++) { const o = new Okey([1, 2, 3, 4].map(i => ({ id: i, name: 'p' + i })));
  assert.deepStrictEqual(o.players.map(p => p.hand.length), [22, 21, 21, 21]); assert.strictEqual(o.deck.length, 106 - 1 - 85);
  let n = 0; while (!o.over && n++ < 500) { const pi = o.turn, p = o.players[pi];
    if (o.phase === 'draw') assert(!o.act(pi, { type: 'draw', from: 'deck' }).error); else assert(!o.act(pi, { type: 'discard', id: p.hand[0].id }).error); }
  assert(o.over); }
let ended = 0;
for (let g = 0; g < 200; g++) { const m = new Monopoly([1, 2, 3].map(i => ({ id: i, name: 'p' + i }))); let n = 0;
  while (!m.over && n++ < 4000) { const pi = m.auction ? m.auction.order[m.auction.cur] : m.turn; const r = Math.random();
    let a; if (m.auction) a = r < .4 ? { type: 'bid', amount: m.auction.bid + 10 } : { type: 'pass' };
    else if (m.phase === 'roll') a = { type: 'roll' }; else if (m.phase === 'buy') a = r < .6 ? { type: 'buy' } : { type: 'decline' };
    else a = r < .2 ? { type: 'build', pos: [1, 3, 6, 8, 9][Math.floor(r * 25) % 5] } : { type: 'endTurn' };
    m.act(pi, a); }
  if (m.over) ended++; }
console.log('Testler geçti. Monopoly bot oyunlarından biten:', ended + '/200');
