(function (root) {
  const MAX_QUANTITY = 20;

  function normalize(value, menu) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
    const menuIds = new Set(menu.map((item) => item.id));
    return Object.fromEntries(
      Object.entries(value).filter(
        ([id, quantity]) =>
          menuIds.has(id) && Number.isInteger(quantity) && quantity > 0 && quantity <= MAX_QUANTITY,
      ),
    );
  }

  function add(cart, id, menu) {
    const next = normalize(cart, menu);
    if (!menu.some((item) => item.id === id)) throw new Error('This item is not on the menu.');
    if ((next[id] || 0) >= MAX_QUANTITY) throw new Error('Maximum 20 of each item per order.');
    next[id] = (next[id] || 0) + 1;
    return next;
  }

  function totals(cart, menu) {
    const prices = new Map(menu.map((item) => [item.id, item.price]));
    return Object.entries(normalize(cart, menu)).reduce(
      (result, [id, quantity]) => ({
        count: result.count + quantity,
        total: result.total + prices.get(id) * quantity,
      }),
      { count: 0, total: 0 },
    );
  }

  root.CafeCart = { normalize, add, totals };
})(globalThis);
