import fs from 'node:fs';
import path from 'node:path';

const publicDir = 'public';
const privatePages = new Set(['staff.html', 'staff-login.html', 'order.html', '404.html']);
const sitemapPages = [
  '',
  'menu.html',
  'gallery.html',
  'visit.html',
  'privacy.html',
  'credits.html',
];

function siteOrigin(value) {
  if (!value) return '';
  const url = new URL(value);
  if (!['http:', 'https:'].includes(url.protocol)) {
    throw new Error('SITE_URL must use HTTP or HTTPS.');
  }
  return url.origin;
}

function escapeXml(value) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('"', '&quot;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;');
}

function checkLocalLinks(html, filename) {
  for (const match of html.matchAll(/(?:src|href)="([^"#?]+)(?:[?#][^"]*)?"/g)) {
    const target = match[1];
    if (/^(https?:|tel:|mailto:|data:|\/api\/)/.test(target) || ['/', '/staff'].includes(target))
      continue;
    if (!fs.existsSync(path.join(publicDir, target.replace(/^\//, '')))) {
      throw new Error(`Missing local link in ${filename}: ${target}`);
    }
  }
}

const origin = siteOrigin(process.env.SITE_URL || process.env.URL || '');
const menu = JSON.parse(fs.readFileSync('server/menu.json', 'utf8'));
// The browser menu is generated here so prices cannot drift from API pricing.
fs.writeFileSync(
  path.join(publicDir, 'menu-data.js'),
  `// Generated from server/menu.json by npm run build.\nwindow.MENU_ITEMS = ${JSON.stringify(menu, null, 2)};\n`,
);

for (const filename of fs.readdirSync(publicDir).filter((name) => name.endsWith('.html'))) {
  const filepath = path.join(publicDir, filename);
  let html = fs
    .readFileSync(filepath, 'utf8')
    .replace(/<link\b[^>]*\brel="canonical"[^>]*>\s*/g, '')
    .replace(/<meta\b[^>]*\bproperty="og:url"[^>]*>\s*/g, '');
  if (origin && !privatePages.has(filename)) {
    const url = escapeXml(`${origin}/${filename === 'index.html' ? '' : filename}`);
    html = html.replace(
      '</head>',
      `<link rel="canonical" href="${url}">\n<meta property="og:url" content="${url}">\n</head>`,
    );
  }
  checkLocalLinks(html, filename);
  fs.writeFileSync(filepath, html);
}

const entries = origin
  ? sitemapPages
      .map((page) => `  <url><loc>${escapeXml(`${origin}/${page}`)}</loc></url>`)
      .join('\n')
  : '';
fs.writeFileSync(
  path.join(publicDir, 'sitemap.xml'),
  `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${entries}\n</urlset>\n`,
);
fs.writeFileSync(
  path.join(publicDir, 'robots.txt'),
  [
    'User-agent: *',
    'Allow: /',
    'Disallow: /api/',
    'Disallow: /staff',
    'Disallow: /order',
    ...(origin ? [`Sitemap: ${origin}/sitemap.xml`] : []),
    '',
  ].join('\n'),
);
console.log(`Build complete: ${menu.length} menu items; local page links checked.`);
