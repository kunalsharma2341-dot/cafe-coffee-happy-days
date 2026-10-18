(function (root) {
  'use strict';
  const transitions = {
    Pending: ['Preparing', 'Rejected', 'Cancelled'],
    Preparing: ['Ready'],
    Ready: ['Served'],
    Served: [],
    Rejected: [],
    Cancelled: [],
  };
  const active = (o) => ['Pending', 'Preparing', 'Ready'].includes(o.status);
  function createOrder(menu, cart, table, note, existing = []) {
    if (!Number.isInteger(table) || table < 1 || table > 12)
      throw Error('Choose a table from 1 to 12.');
    const lines = Object.entries(cart).map(([id, quantity]) => {
      const item = menu.find((m) => m.id === id);
      if (!item || !Number.isInteger(quantity) || quantity < 1 || quantity > 20)
        throw Error('Please check the quantities in your cart.');
      return { id, name: item.name, price: item.price, quantity };
    });
    if (!lines.length) throw Error('Add an item before sending your order.');
    if (existing.length >= 500) throw Error('The demo order history is full.');
    return {
      id: 'HD-' + crypto.randomUUID().slice(0, 8).toUpperCase(),
      table,
      note: String(note).slice(0, 240),
      lines,
      total: lines.reduce((n, l) => n + l.price * l.quantity, 0),
      status: 'Pending',
      created: Date.now(),
      updated: Date.now(),
      history: [{ status: 'Pending', at: Date.now() }],
    };
  }
  function advance(order, next, reason = '') {
    if (!transitions[order.status]?.includes(next))
      throw Error('That status change is no longer available.');
    if (next === 'Rejected' && !String(reason).trim())
      throw Error('Please provide a reason for rejecting this order.');
    const at = Date.now();
    return {
      ...order,
      status: next,
      reason: next === 'Rejected' ? String(reason).trim().slice(0, 180) : order.reason,
      updated: at,
      history: [...order.history, { status: next, at }],
    };
  }
  const api = { createOrder, advance, active, transitions };
  if (typeof module !== 'undefined') module.exports = api;
  else root.OrderCore = api;
})(typeof window !== 'undefined' ? window : globalThis);
