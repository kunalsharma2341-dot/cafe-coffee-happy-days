'use strict';
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const nav = $('#navigation'),
  toggle = $('.menu-toggle');
function closeNav() {
  nav?.classList.remove('open');
  toggle?.setAttribute('aria-expanded', 'false');
  toggle?.setAttribute('aria-label', 'Open navigation');
}
toggle?.addEventListener('click', () => {
  const open = toggle.getAttribute('aria-expanded') !== 'true';
  toggle.setAttribute('aria-expanded', String(open));
  toggle.setAttribute('aria-label', open ? 'Close navigation' : 'Open navigation');
  nav.classList.toggle('open', open);
});
document.addEventListener('click', (e) => {
  if (!e.target.closest('.header')) closeNav();
});
$$('#navigation a').forEach((a) => a.addEventListener('click', closeNav));
let returnFocus = null;
function openDialog(d, trigger) {
  if (!d) return;
  returnFocus = trigger || document.activeElement;
  closeNav();
  d.showModal();
  document.body.style.overflow = 'hidden';
}
$$('[data-contact]').forEach((b) =>
  b.addEventListener('click', () => openDialog($('#contact-dialog'), b)),
);
$$('[data-table-demo]').forEach((b) =>
  b.addEventListener('click', () => openDialog($('#table-demo-dialog'), b)),
);
const meetingPreview = new URLSearchParams(location.search).get('meeting') === '1';
if (meetingPreview && $('#table-demo-dialog'))
  setTimeout(() => {
    if (!$('#table-demo-dialog').open) openDialog($('#table-demo-dialog'));
  }, 1300);

$$('dialog').forEach((d) => {
  d.addEventListener('close', () => {
    document.body.style.overflow = '';
    returnFocus?.focus();
  });
  $$('[data-close]', d).forEach((b) => b.addEventListener('click', () => d.close()));
  d.addEventListener('click', (e) => {
    if (e.target === d) {
      const r = d.getBoundingClientRect();
      if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom)
        d.close();
    }
  });
});
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') closeNav();
});
let category = 'All';
const search = $('#menu-search');
function filterMenu() {
  if (!search) return;
  const q = search.value.trim().toLowerCase();
  let count = 0;
  $$('[data-menu-category]').forEach((item) => {
    const visible =
      (category === 'All' || item.dataset.menuCategory === category) &&
      item.dataset.name.includes(q);
    item.hidden = !visible;
    if (visible) count++;
  });
  $$('[data-group]').forEach(
    (group) => (group.hidden = !$$('[data-menu-category]', group).some((i) => !i.hidden)),
  );
  $('#result-count').textContent = count + ' menu item' + (count === 1 ? '' : 's');
  $('#menu-empty').hidden = count !== 0;
}
$$('[data-menu-filter]').forEach((b) =>
  b.addEventListener('click', () => {
    category = b.dataset.menuFilter;
    $$('[data-menu-filter]').forEach((t) => {
      const active = t === b;
      t.classList.toggle('active', active);
      t.setAttribute('aria-pressed', String(active));
    });
    filterMenu();
  }),
);
search?.addEventListener('input', filterMenu);
$('#reset-menu')?.addEventListener('click', () => {
  search.value = '';
  $('[data-menu-filter="All"]').click();
  search.focus();
});
$$('[data-gallery-filter]').forEach((b) =>
  b.addEventListener('click', () => {
    $$('[data-gallery-filter]').forEach((t) => {
      t.classList.toggle('active', t === b);
      t.setAttribute('aria-pressed', String(t === b));
    });
    $$('[data-gallery-category]').forEach(
      (tile) =>
        (tile.hidden =
          b.dataset.galleryFilter !== 'All' &&
          tile.dataset.galleryCategory !== b.dataset.galleryFilter),
    );
  }),
);
let photos = [],
  currentPhoto = 0;
function showPhoto() {
  const photo = photos[currentPhoto];
  if (!photo) return;
  $('#large-photo').src = photo.dataset.photo;
  $('#large-photo').alt = photo.dataset.caption;
  $('#photo-label').textContent =
    photo.dataset.caption +
    (photos.length > 1 ? ' · ' + (currentPhoto + 1) + ' / ' + photos.length : '');
  $('#previous-photo').hidden = photos.length < 2;
  $('#next-photo').hidden = photos.length < 2;
}
$$('[data-photo]').forEach((b) =>
  b.addEventListener('click', () => {
    photos = b.closest('.gallery-grid')
      ? $$('[data-photo]', b.closest('.gallery-grid')).filter((p) => !p.hidden)
      : [b];
    currentPhoto = photos.indexOf(b);
    showPhoto();
    openDialog($('#photo-dialog'), b);
  }),
);
function stepPhoto(n) {
  if (!photos.length) return;
  currentPhoto = (currentPhoto + n + photos.length) % photos.length;
  showPhoto();
}
$('#previous-photo')?.addEventListener('click', () => stepPhoto(-1));
$('#next-photo')?.addEventListener('click', () => stepPhoto(1));
document.addEventListener('keydown', (e) => {
  if (!$('#photo-dialog')?.open) return;
  if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
    e.preventDefault();
    stepPhoto(e.key === 'ArrowRight' ? 1 : -1);
  }
});
let startX = 0;
$('#large-photo')?.addEventListener(
  'touchstart',
  (e) => {
    startX = e.changedTouches[0].clientX;
  },
  { passive: true },
);
$('#large-photo')?.addEventListener(
  'touchend',
  (e) => {
    const dx = e.changedTouches[0].clientX - startX;
    if (Math.abs(dx) > 55) stepPhoto(dx < 0 ? 1 : -1);
  },
  { passive: true },
);
let toastTimer;
function toast(text) {
  const t = $('.toast');
  if (!t) return;
  clearTimeout(toastTimer);
  t.textContent = text;
  t.classList.add('visible');
  toastTimer = setTimeout(() => t.classList.remove('visible'), 4000);
}
$('#copy-address')?.addEventListener('click', async () => {
  const address = 'Cafe Coffee Happy Days, Main Bus Stand, Kunda, Amer, Jaipur, Rajasthan 302028';
  try {
    await navigator.clipboard.writeText(address);
    toast('Address copied. See you at Happy Days.');
  } catch {
    const range = document.createRange();
    range.selectNodeContents($('#address'));
    const selection = window.getSelection();
    selection.removeAllRanges();
    selection.addRange(range);
    toast('Address selected. Use your device’s copy option.');
  }
});
$('#load-map')?.addEventListener('click', () => {
  const frame = document.createElement('iframe');
  frame.src =
    'https://maps.google.com/maps?q=Cafe%20Coffee%20Happy%20Days%20Kunda%20Amer%20Jaipur&output=embed';
  frame.title = 'Map to Cafe Coffee Happy Days, Kunda, Amer';
  frame.loading = 'lazy';
  frame.referrerPolicy = 'no-referrer-when-downgrade';
  frame.allowFullscreen = true;
  const note = document.createElement('p');
  note.className = 'map-loaded-note';
  const a = document.createElement('a');
  a.href =
    'https://www.google.com/maps/search/?api=1&query=Cafe+Coffee+Happy+Days+Kunda+Amer+Jaipur';
  a.target = '_blank';
  a.rel = 'noopener noreferrer';
  a.textContent = 'Map not loading? Open directions in Google Maps ↗';
  note.append(a);
  const parent = $('#map-container');
  parent.replaceWith(frame, note);
});
// Let visitors choose an outlet view; no autoplay or forced motion.
$$('[data-cafe-view]').forEach((button) =>
  button.addEventListener('click', () => {
    const hero = $('.hero-photo');
    if (!hero) return;
    const source = 'assets/' + button.dataset.cafeView + '.webp';
    const caption = button.dataset.viewCaption;
    const img = $('img', hero);
    img.src = source;
    img.alt = caption;
    hero.dataset.photo = source;
    hero.dataset.caption = caption;
    $$('[data-cafe-view]').forEach((b) => {
      const selected = b === button;
      b.classList.toggle('active', selected);
      b.setAttribute('aria-pressed', String(selected));
    });
  }),
);
// Gentle feedback when filtering, while respecting reduced-motion preferences.
$$('[data-gallery-filter],[data-menu-filter]').forEach((button) =>
  button.addEventListener('click', () => {
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const target = button.hasAttribute('data-gallery-filter') ? '.gallery-tile' : '.menu-group';
    $$(target)
      .filter((el) => !el.hidden)
      .forEach((el) => {
        if (el.animate)
          el.animate([{ opacity: 0.55 }, { opacity: 1 }], { duration: 180, easing: 'ease-out' });
      });
  }),
);

const requestedCategory = new URLSearchParams(location.search).get('category');
if (requestedCategory) {
  const filter = $$('[data-gallery-filter]').find(
    (b) => b.dataset.galleryFilter.toLowerCase() === requestedCategory.toLowerCase(),
  );
  filter?.click();
}
function menuHash() {
  const group = document.querySelector(
    location.hash && /^#[a-z-]+$/.test(location.hash) ? location.hash : '.not-present',
  );
  if (group?.dataset.group) {
    category = group.dataset.group;
    $$('[data-menu-filter]').forEach((b) => {
      const active = b.dataset.menuFilter === category;
      b.classList.toggle('active', active);
      b.setAttribute('aria-pressed', String(active));
    });
    filterMenu();
  }
}
menuHash();
window.addEventListener('hashchange', menuHash);

// Show the welcome overlay only for table QR links.
(function () {
  const params = new URLSearchParams(location.search);
  const fromQr = params.get('source') === 'table-qr' || params.get('qr') === '1';
  const overlay = document.getElementById('qr-entry-overlay');
  if (!overlay || !fromQr) return;
  overlay.setAttribute('aria-hidden', 'false');
  document.body.classList.add('qr-entry-active');
  setTimeout(() => overlay.classList.add('play'), 60);
  setTimeout(() => {
    overlay.classList.add('hide');
    document.body.classList.remove('qr-entry-active');
  }, 1800);
})();
