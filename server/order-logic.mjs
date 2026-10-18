export const transitions = {
  Pending: ['Preparing', 'Rejected', 'Cancelled'],
  Preparing: ['Ready'],
  Ready: ['Served'],
  Served: [],
  Rejected: [],
  Cancelled: [],
};
export function makeOrder(menu, input) {
  if (!input || !Number.isInteger(input.table) || input.table < 1 || input.table > 12)
    throw Error('Choose a valid table.');
  if (typeof input.requestKey !== 'string' || !/^[a-zA-Z0-9-]{20,80}$/.test(input.requestKey))
    throw Error('Invalid order request key.');
  if (!Array.isArray(input.items) || !input.items.length || input.items.length > 19)
    throw Error('Choose valid menu items.');
  const seen = new Set();
  const lines = input.items.map(({ id, quantity }) => {
    const m = menu.find((m) => m.id === id);
    if (!m || seen.has(id) || !Number.isInteger(quantity) || quantity < 1 || quantity > 20)
      throw Error('Please check your order quantities.');
    seen.add(id);
    return { id, name: m.name, price: m.price, quantity };
  });
  if (input.note !== undefined && (typeof input.note !== 'string' || input.note.length > 240))
    throw Error('Kitchen note is too long.');
  const at = Date.now();
  return {
    id: 'HD-' + crypto.randomUUID().slice(0, 12).toUpperCase(),
    table: input.table,
    note: input.note || '',
    lines,
    total: lines.reduce((n, l) => n + l.price * l.quantity, 0),
    status: 'Pending',
    created: at,
    updated: at,
    history: [{ status: 'Pending', at }],
  };
}
export function changeOrder(order, next, reason, staff, owner) {
  if (!staff && !(owner && order.status === 'Pending' && next === 'Cancelled'))
    throw Error('You cannot change this order.');
  if (!transitions[order.status]?.includes(next))
    throw Error('This status change is no longer available.');
  if (next === 'Rejected' && (typeof reason !== 'string' || !reason.trim() || reason.length > 180))
    throw Error('Provide a rejection reason of 1–180 characters.');
  const at = Date.now();
  return {
    ...order,
    status: next,
    reason: next === 'Rejected' ? reason.trim() : order.reason,
    updated: at,
    history: [...order.history, { status: next, at }],
  };
}
