# Cafe Coffee Happy Days

A website project for Cafe Coffee Happy Days in Kunda, Amer, Jaipur. The main idea is simple: customers can check the menu, find the cafe and place an order from their table. Staff can check incoming orders from a separate dashboard.

The frontend uses HTML, CSS and JavaScript. The order API runs on Netlify Functions, and orders are stored in Netlify Blobs.

## What it does

- Search the menu and filter dishes by category.
- Add items to a cart and place a table order.
- Check the status of an order in the same browser.
- Sign in as staff to accept or reject orders and update their status.
- Browse cafe photos and open contact details or directions.

This repository includes both the website and the ordering backend. Payments are handled at the cafe.

## Development

Requires Node.js 22 or newer and a linked Netlify site.

```sh
npm ci
npm run setup
npx netlify-cli login
npx netlify-cli link
npm run dev
```

Setup writes a local `.env` with a staff password hash and session secret. Password entry is visible in the terminal. Never commit `.env`.

## Deployment

Create or link a Netlify site, then run:

```sh
npx netlify-cli env:import .env
npm test
npm run deploy
```

Deploy the whole project through the CLI or a Git repository. Uploading `public/` alone cannot run the order API. Windows users can use `SETUP.bat` and `UPDATE.bat` for guided deployment.

Set `SITE_URL` for a custom domain; otherwise the build uses Netlify's `URL` to generate canonical links and the sitemap.

## Source layout

- `public/`: pages, browser scripts, styles and bundled images.
- `server/menu.json`: authoritative menu prices; build generates `public/menu-data.js`.
- `server/order-logic.mjs`: order validation and status transitions.
- `server/auth.mjs`: password checks and signed sessions.
- `server/api.mjs`: HTTP routes, permissions and storage updates.
- `netlify/functions/api.mjs`: Netlify entry point.
- `scripts/`: setup and build tasks.
- `tests/`: backend and cart checks.

After changing `server/menu.json`, run `npm run build`. Menu card markup and `menu-details-data.js` are maintained separately; update them when changing dishes.

`site.css` combines the main page styles in their existing cascade order. Privacy uses `style.css` and `refined.css`; order and staff pages use `order.css`. Browser scripts use classic script tags: load shared globals such as `CafeCart`, `openDialog` and `toast` before scripts that call them.

## Orders and maintenance

Tables run from 1–12. Signed browser cookies identify customer orders. Staff sign in at `/staff` to update or export orders. Payments are collected at the cafe. Clearing cookies loses access to that browser's customer order history.

Prices are validated on the server. Storage revisions handle concurrent updates; request keys prevent duplicate submissions. Staff sessions last eight hours. Rotating `SESSION_SECRET` invalidates existing sessions.

The ledger stops accepting new orders at 10,000 entries. The staff dashboard shows the latest 300. Export records regularly; exports do not clear the ledger, and archiving is not implemented. Local, preview and production stores are separate.

## Verification

```sh
npm test
npm run build
```

Tests use in-memory storage to check authentication, customer isolation, pricing, transitions, duplicate submissions, concurrent updates and rate limits. Build checks local page links and generates menu data and search metadata.

Before taking real orders, submit one at `/order.html`, sign in at `/staff`, and move it through Preparing, Ready and Served. Check customer status on a second device, export records and sign out. Automated tests do not verify a live Netlify deployment.

## Photos

Bundled cafe photos are in `public/assets/`. Representative dish photos load from Wikimedia and are credited in `credits.html` and `MENU-PHOTO-SOURCES.txt`. They are not photos of this cafe's actual dishes. Preserve attribution and replace them with verified cafe dish photos when available.

## Author

Kunal Sharma
