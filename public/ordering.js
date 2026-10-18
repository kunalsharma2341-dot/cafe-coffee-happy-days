'use strict';
const q = (s) => document.querySelector(s),
  core = window.OrderCore,
  menu = window.MENU_ITEMS,
  KEY = 'happy-days-orders-v1',
  CART = 'happy-days-cart-v1';
const esc = (s) =>
  String(s).replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c],
  );
const money = (n) => '₹' + n.toLocaleString('en-IN');
let storeOK = true;
function read(key, fallback) {
  try {
    return JSON.parse(localStorage.getItem(key)) || fallback;
  } catch {
    storeOK = false;
    return fallback;
  }
}

function save(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    storeOK = true;
    return true;
  } catch {
    storeOK = false;
    announce('Browser storage is unavailable. Enable it to save your order.');
    return false;
  }
}
function announce(s) {
  q('#announcer').textContent = s;
}
async function change(id, next, reason) {
  try {
    const data = await api('/api/orders/' + encodeURIComponent(id), 'PATCH', {
      status: next,
      reason,
      revision: remoteOrders.find((o) => o.id === id)?.revision,
    });
    remoteOrders = remoteOrders.map((o) => (o.id === id ? data.order : o));
    announce('Order updated');
    render();
    await sync();
  } catch (e) {
    announce(e.message);
    if (!isStaff) q('#feedback').textContent = e.message;
    else alert(e.message);
    await sync();
  }
}

const isStaff = Boolean(document.querySelector('[data-page=staff]'));
let remoteOrders = [],
  authenticated = false,
  apiReady = false,
  sendBusy = false;
function orders() {
  return remoteOrders;
}
async function api(path, method = 'GET', body) {
  const response = await fetch(path, {
    method,
    credentials: 'same-origin',
    headers: body ? { 'Content-Type': 'application/json' } : {},
    body: body ? JSON.stringify(body) : undefined,
    cache: 'no-store',
  });
  let data;
  try {
    data = await response.json();
  } catch {
    throw Error('Unable to reach the order service.');
  }
  if (!response.ok) throw Error(data.error || 'Unable to complete this request.');
  return data;
}
async function sync() {
  try {
    const me = await api('/api/me');
    authenticated = me.signedIn;
    if (isStaff && !me.staff) {
      location.replace('/staff-login.html');
      return;
    }
    if (authenticated) {
      remoteOrders = (await api('/api/orders' + (isStaff ? '?scope=staff' : ''))).orders;
    } else remoteOrders = [];
    apiReady = true;
    if (!isStaff) {
      q('#signin').hidden = authenticated;
    }
    render();
  } catch (e) {
    apiReady = false;
    if (!isStaff)
      q('#feedback').textContent = e.message + ' Your cart is saved; please retry shortly.';
    else q('#updated').textContent = 'Connection unavailable · retrying';
    render();
  }
}
let cart = read(CART, {});
if (!cart || typeof cart !== 'object' || Array.isArray(cart)) cart = {};
cart = Object.fromEntries(
  Object.entries(cart).filter(
    ([id, n]) => menu.some((m) => m.id === id) && Number.isInteger(n) && n > 0 && n <= 20,
  ),
);
const selectedItem = menu.find((m) => m.id === new URLSearchParams(location.search).get('item'));
if (selectedItem && q('#item-search')) q('#item-search').value = selectedItem.name;
let cat = 'All';
const tableParam = new URLSearchParams(location.search).get('table');
const parsedTable =
  tableParam && /^T?\d{1,2}$/i.test(tableParam) ? Number(tableParam.replace(/^T/i, '')) : 0;
let selectedTable = Number(parsedTable || readSession() || 0);
function readSession() {
  try {
    return sessionStorage.getItem('happy-days-table');
  } catch {
    return 0;
  }
}
if (!Number.isInteger(selectedTable) || selectedTable < 1 || selectedTable > 12) selectedTable = 0;
const time = (t) => new Date(t).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
const lines = (o) =>
  o.lines
    .map(
      (l) =>
        `<li><span>${esc(l.quantity)} × ${esc(l.name)}</span><b>${money(Number(l.price) * Number(l.quantity))}</b></li>`,
    )
    .join('');
if (!isStaff) {
  q('#table').innerHTML =
    '<option value="0">Select table</option>' +
    Array.from({ length: 12 }, (_, i) => `<option value="${i + 1}">Table ${i + 1}</option>`).join(
      '',
    );
  q('#table').value = selectedTable;
  q('#table').onchange = () => {
    selectedTable = Number(q('#table').value);
    try {
      sessionStorage.setItem('happy-days-table', selectedTable);
    } catch {}
    render();
  };
  q('#categories').innerHTML = ['All', ...new Set(menu.map((m) => m.category))]
    .map(
      (c) =>
        `<button data-category="${esc(c)}" aria-pressed="${c === 'All'}" class="${c === 'All' ? 'chosen' : ''}">${esc(c)}</button>`,
    )
    .join('');
  q('#categories').onclick = (e) => {
    const b = e.target.closest('[data-category]');
    if (!b) return;
    cat = b.dataset.category;
    q('#item-search').value = '';
    render();
  };
  q('#item-search').oninput = render;
  q('#products').onclick = (e) => {
    const b = e.target.closest('[data-add]');
    if (!b) return;
    adjust(b.dataset.add, 1);
  };
  q('#cart').onclick = (e) => {
    const b = e.target.closest('[data-quantity]');
    if (b) adjust(b.dataset.id, Number(b.dataset.quantity));
  };
  q('#place-order').onclick = async () => {
    if (sendBusy) return;
    sendBusy = true;
    render();
    try {
      const signature = JSON.stringify({
        table: selectedTable,
        items: Object.entries(cart),
        note: q('#note').value,
      });
      let pending = read('happy-days-request', null);
      if (!pending || pending.signature !== signature)
        pending = { signature, key: crypto.randomUUID() };
      if (!save('happy-days-request', pending)) return;
      const data = await api('/api/orders', 'POST', {
        table: selectedTable,
        items: Object.entries(cart).map(([id, quantity]) => ({ id, quantity })),
        note: q('#note').value,
        requestKey: pending.key,
      });
      remoteOrders = [data.order, ...remoteOrders.filter((o) => o.id !== data.order.id)];
      cart = {};
      save(CART, cart);
      save('happy-days-request', null);
      q('#note').value = '';
      q('#feedback').textContent = 'Order sent to the café. Follow preparation updates below.';
    } catch (e) {
      q('#feedback').textContent = e.message;
    } finally {
      sendBusy = false;
      render();
    }
  };

  q('#tracking').onclick = (e) => {
    const b = e.target.closest('[data-cancel]');
    if (b) change(b.dataset.cancel, 'Cancelled');
  };
} else {
  q('#status-filter').onchange = render;
  q('#order-search').oninput = render;

  q('#queue').onclick = (e) => {
    const b = e.target.closest('[data-next]');
    if (!b) return;
    let reason = '';
    if (b.dataset.next === 'Rejected') {
      reason = prompt('Reason for rejection (shown to the customer):');
      if (reason === null) return;
    }
    change(b.dataset.id, b.dataset.next, reason);
  };
}
function adjust(id, delta) {
  const n = (cart[id] || 0) + delta;
  if (n > 20) {
    announce('Maximum 20 of each item per order.');
    return;
  }
  if (n <= 0) delete cart[id];
  else cart[id] = n;
  save(CART, cart);
  render();
}
function renderCustomer() {
  const search = q('#item-search').value.trim().toLowerCase(),
    shown = menu.filter(
      (m) => (cat === 'All' || cat === m.category) && m.name.toLowerCase().includes(search),
    );
  q('#categories')
    .querySelectorAll('button')
    .forEach((b) => {
      b.classList.toggle('chosen', b.dataset.category === cat);
      b.setAttribute('aria-pressed', b.dataset.category === cat);
    });
  q('#products').innerHTML = shown.length
    ? shown
        .map((m) => {
          const photo = window.MENU_PHOTOS[m.id];
          return `<article class="product"><div class="product-picture"><img data-food-photo src="${esc(photo.src)}" alt="${esc(photo.alt)}" loading="lazy" decoding="async" referrerpolicy="no-referrer"><small>${esc(photo.caption)}</small></div><div class="product-info"><p class="muted">${esc(m.category)} · Vegetarian</p><h2>${esc(m.name)}</h2><p class="product-detail">Portion: ${esc(window.MENU_DETAILS?.[m.id]?.portion || 'Ask the café')}<br>Spice: ${esc(window.MENU_DETAILS?.[m.id]?.spice || 'Ask the café')}</p><div class="product-bottom"><strong>${money(m.price)}</strong><button data-add="${m.id}" aria-label="Add ${esc(m.name)} to order">Add +</button></div></div></article>`;
        })
        .join('')
    : '<div class="empty">No items match your search. Try another name or category.</div>';

  const entries = Object.entries(cart);
  let total = 0,
    count = 0;
  q('#cart').innerHTML = entries.length
    ? entries
        .map(([id, n]) => {
          const m = menu.find((x) => x.id === id);
          total += m.price * n;
          count += n;
          return `<div class="cart-line"><div><strong>${esc(m.name)}</strong><small>${money(m.price * n)}</small></div><div class="stepper"><button data-id="${id}" data-quantity="-1" aria-label="Remove one ${esc(m.name)}">−</button><span>${n}</span><button data-id="${id}" data-quantity="1" aria-label="Add one ${esc(m.name)}">+</button></div></div>`;
        })
        .join('')
    : '<p class="empty">Your cart is empty.<br>Add something from the menu.</p>';
  q('#total').textContent = money(total);
  q('#cart-count').textContent = count + ' items';
  q('#place-order').disabled =
    !count || !selectedTable || !storeOK || !authenticated || !apiReady || sendBusy;
  q('#place-order').textContent = sendBusy ? 'Sending order…' : 'Place table order';
  q('#table-message').innerHTML = selectedTable
    ? (tableParam ? '<span class=\"qr-detected\">QR detected</span> ' : '') +
      'Ordering for <strong>Table ' +
      String(selectedTable).padStart(2, '0') +
      '</strong>'
    : 'Select your table when you are ready to place the order.';
  const own = orders()
    .filter((o) => o.table === selectedTable)
    .sort((a, b) => b.created - a.created);
  q('#tracking').innerHTML = own.length
    ? '<h2>Table ' +
      selectedTable +
      ' · Order updates</h2>' +
      own
        .map(
          (o) =>
            `<article class="tracking-card"><div class="panel-title"><strong>${esc(o.id)}</strong><span class="status status-${o.status}">${esc(o.status)}</span></div><small>${time(o.created)} · ${money(o.total)}</small><ul class="order-lines">${lines(o)}</ul>${o.reason ? '<p class="rejection">' + esc(o.reason) + '</p>' : ''}<ol class="timeline">${o.history.map((h) => `<li>${esc(h.status)} <small>${time(h.at)}</small></li>`).join('')}</ol>${o.status === 'Pending' ? `<button class="secondary" data-cancel="${esc(o.id)}">Cancel pending order</button>` : ''}</article>`,
        )
        .join('')
    : '';
}
function renderStaff() {
  const all = orders(),
    live = all.filter(core.active),
    served = all.filter((o) => o.status === 'Served'),
    status = q('#status-filter').value,
    search = q('#order-search').value.toLowerCase();
  q('#metrics').innerHTML = [
    ['Pending', all.filter((o) => o.status === 'Pending').length],
    ['In progress', live.filter((o) => o.status !== 'Pending').length],
    ['Active tables', new Set(live.map((o) => o.table)).size],
    ['Served subtotal', money(served.reduce((n, o) => n + o.total, 0))],
  ]
    .map(
      ([label, value]) =>
        `<div class="metric"><span>${label}</span><strong>${value}</strong></div>`,
    )
    .join('');
  const shown = all
    .filter(
      (o) =>
        (status === 'all' || (status === 'active' ? core.active(o) : o.status === status)) &&
        (o.id + ' table ' + o.table).toLowerCase().includes(search),
    )
    .sort((a, b) => a.created - b.created);
  q('#queue').innerHTML = shown.length
    ? shown
        .map(
          (o) =>
            `<article class="queue-card"><div class="panel-title"><div><h3>Table ${o.table}</h3><small>${esc(o.id)} · ${time(o.created)}</small></div><span class="status status-${o.status}">${o.status}</span></div><ul class="order-lines">${lines(o)}</ul>${o.note ? '<p class="kitchen-note"><b>Kitchen note:</b> ' + esc(o.note) + '</p>' : ''}${o.reason ? '<p class="rejection">' + esc(o.reason) + '</p>' : ''}<div class="order-actions"><strong>${money(o.total)}</strong><div>${core.transitions[
              o.status
            ]
              .filter((s) => s !== 'Cancelled')
              .map(
                (s) =>
                  `<button data-id="${esc(o.id)}" data-next="${s}" class="${s === 'Rejected' ? 'secondary' : 'primary'}">${{ Preparing: 'Accept & prepare', Rejected: 'Reject', Ready: 'Mark ready', Served: 'Mark served' }[s]}</button>`,
              )
              .join('')}</div></div></article>`,
        )
        .join('')
    : '<div class="empty queue-empty"><h3>No orders in this view</h3><p>New customer orders appear here. Place an order from the customer menu to try the dashboard.</p></div>';
  q('#tables').innerHTML = Array.from({ length: 12 }, (_, i) => {
    const n = live.filter((o) => o.table === i + 1).length;
    return `<a class="table-tile ${n ? 'occupied' : ''}" href="order.html?table=${i + 1}" target="_blank" rel="noopener"><strong>${i + 1}</strong><small>${n ? n + ' active' : 'Available'}</small></a>`;
  }).join('');
  q('#updated').textContent = 'Updated ' + time(Date.now());
}
function render() {
  isStaff ? renderStaff() : renderCustomer();
}
document.addEventListener('visibilitychange', () => {
  if (!document.hidden) sync();
});
render();
sync();
setInterval(() => {
  if (!document.hidden && !sendBusy) sync();
}, 5000);

// Premium QR-entry welcome. Runs only when the ordering page was opened from a table QR/demo.
(function () {
  const params = new URLSearchParams(location.search);
  const qrEntry =
    params.get('source') === 'table-qr' ||
    params.get('source') === 'meeting-demo' ||
    params.get('qr') === '1';
  const welcome = document.getElementById('cafe-qr-welcome');
  if (!qrEntry || !welcome) return;
  welcome.setAttribute('aria-hidden', 'false');
  requestAnimationFrame(() => welcome.classList.add('show'));
  const closeWelcome = () => {
    welcome.classList.add('leave');
    setTimeout(() => {
      welcome.classList.remove('show');
      welcome.setAttribute('aria-hidden', 'true');
    }, 320);
  };
  setTimeout(closeWelcome, 1700);
  welcome.addEventListener('click', closeWelcome, { once: true });
})();
