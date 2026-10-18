document.querySelectorAll('[data-item-details]').forEach((button) =>
  button.addEventListener('click', () => {
    const item = window.MENU_ITEMS.find((m) => m.id === button.dataset.itemDetails);
    if (!item) return;
    const detail = window.MENU_DETAILS[item.id];
    for (const [id, text] of Object.entries({
      'dish-title': item.name,
      'dish-category': item.category + ' · Vegetarian',
      'dish-price': '₹' + item.price,
      'dish-portion': detail.portion,
      'dish-spice': detail.spice,
      'dish-availability': 'Staff review before preparation',
    }))
      document.getElementById(id).textContent = text;
    document.getElementById('dish-add').dataset.menuAdd = item.id;
    openDialog(document.getElementById('dish-dialog'), button);
  }),
);
