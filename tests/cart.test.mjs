import test from 'node:test';
import assert from 'node:assert/strict';
import '../public/cart-core.js';

const menu = [{ id: 'coffee', price: 80 }, { id: 'tea', price: 30 }];
const { normalize, add, totals } = globalThis.CafeCart;

test('stored carts discard removed dishes and invalid quantities', () => {
  assert.deepEqual(normalize({ coffee: 2, tea: -1, removed: 3 }, menu), { coffee: 2 });
  for (const invalid of [null, [], 'coffee']) assert.deepEqual(normalize(invalid, menu), {});
  for (const quantity of [0, 21, 1.5, '2']) assert.deepEqual(normalize({ coffee: quantity }, menu), {});
});

test('adding respects quantity limits and does not mutate the saved cart', () => {
  const saved = { coffee: 19 };
  const updated = add(saved, 'coffee', menu);
  assert.equal(saved.coffee, 19);
  assert.equal(updated.coffee, 20);
  assert.throws(() => add(updated, 'coffee', menu), /Maximum 20/);
  assert.throws(() => add(saved, 'removed', menu), /not on the menu/);
});

test('cart subtotal uses current menu prices and ignores stale entries', () => {
  assert.deepEqual(totals({ coffee: 2, tea: 3, removed: 9 }, menu), { count: 5, total: 250 });
});
