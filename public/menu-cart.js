(() => {
  const key = 'happy-days-cart-v1',
    menu = window.MENU_ITEMS,
    core = window.CafeCart;
  const feedback = document.getElementById('menu-cart-feedback');
  function read() {
    try {
      return core.normalize(JSON.parse(localStorage.getItem(key) || '{}'), menu);
    } catch {
      return {};
    }
  }
  function paint() {
    const { count, total } = core.totals(read(), menu);
    document.getElementById('menu-order-bar').hidden = !count;
    document.getElementById('menu-cart-count').textContent =
      count + ' item' + (count === 1 ? '' : 's') + ' in your order';
    document.getElementById('menu-cart-total').textContent =
      '₹' + total.toLocaleString('en-IN') + ' · menu subtotal';
    document.body.classList.toggle('has-menu-cart', count > 0);
  }
  document.addEventListener('click', (e) => {
    const button = e.target.closest('[data-menu-add]');
    if (!button) return;
    const id = button.dataset.menuAdd;
    try {
      const cart = core.add(read(), id, menu);
      localStorage.setItem(key, JSON.stringify(cart));
      const item = menu.find((m) => m.id === id);
      feedback.textContent = item.name + ' added to your order.';
      toast(item.name + ' added · Review order to continue');
      paint();
    } catch (err) {
      feedback.textContent =
        err.name === 'QuotaExceededError' || err.name === 'SecurityError'
          ? 'Enable browser storage to save your order.'
          : err.message;
      toast(feedback.textContent);
    }
  });
  window.addEventListener('storage', (e) => {
    if (e.key === key) paint();
  });
  paint();
})();
