import test from 'node:test';
import assert from 'node:assert/strict';
import { createHandler } from '../server/api.mjs';
import { passwordHash, readSession } from '../server/auth.mjs';
const secret = 'test-session-secret-'.repeat(4),
  hash = passwordHash('test-password-long-enough');
export class MemoryStore {
  constructor() {
    this.rows = new Map();
    this.rev = 0;
    this.conflicts = 0;
  }
  async get(k) {
    return this.rows.has(k) ? structuredClone(this.rows.get(k).data) : null;
  }
  async getWithMetadata(k) {
    return this.rows.has(k) ? structuredClone(this.rows.get(k)) : null;
  }
  async setJSON(k, data, opts = {}) {
    if (this.conflicts-- > 0) return { modified: false };
    const old = this.rows.get(k);
    if ((opts.onlyIfNew && old) || (opts.onlyIfMatch && old?.etag !== opts.onlyIfMatch))
      return { modified: false };
    const etag = String(++this.rev);
    this.rows.set(k, { data: structuredClone(data), etag });
    return { modified: true, etag };
  }
}
function fixture() {
  const store = new MemoryStore(),
    env = { SESSION_SECRET: secret, STAFF_PASSWORD_HASH: hash, CONTEXT: 'production' };
  const handler = createHandler({ getStore: () => store, env });
  return { store, env, handler };
}
const request = (path, method = 'GET', body, cookie = '', origin = 'https://cafe.test') =>
  new Request('https://cafe.test' + path, {
    method,
    headers: {
      ...(cookie ? { cookie } : {}),
      ...(method !== 'GET' ? { 'Content-Type': 'application/json', Origin: origin } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
const invoke = (f, path, method, body, cookie = '', ip = '1.1.1.1') =>
  f.handler(request(path, method, body, cookie), { ip });
async function guest(f) {
  const r = await invoke(f, '/api/me', 'GET');
  assert.equal(r.status, 200);
  return r.headers.get('set-cookie').split(';')[0];
}
async function staff(f) {
  const r = await invoke(f, '/api/staff/login', 'POST', { password: 'test-password-long-enough' });
  assert.equal(r.status, 200);
  return r.headers.get('set-cookie').split(';')[0];
}
const input = (key = crypto.randomUUID()) => ({
  table: 1,
  items: [{ id: '6', quantity: 2 }],
  note: 'No chilli please',
  requestKey: key,
  price: 1,
  total: 1,
});
async function order(f, cookie, body = input(), ip) {
  const r = await invoke(f, '/api/orders', 'POST', body, cookie, ip);
  assert.equal(r.status, 201, await r.clone().text());
  return (await r.json()).order;
}
test('guest cookie is signed, HTTP-only, Secure and not staff; invalid token rejected', async () => {
  const f = fixture(),
    c = await guest(f);
  const me = await invoke(f, '/api/me', 'GET', undefined, c);
  assert.equal((await me.json()).staff, false);
  const r = await invoke(f, '/api/me', 'GET');
  assert.match(r.headers.get('set-cookie'), /HttpOnly.*SameSite=Lax.*Secure/);
  assert.equal((await invoke(f, '/api/orders', 'GET', undefined, c + 'x')).status, 401);
  assert.equal(readSession(request('/api/me', 'GET', undefined, c), secret).role, 'guest');
});
test('server prices, ownership and customer cancellation', async () => {
  const f = fixture(),
    a = await guest(f),
    b = await guest(f),
    o = await order(f, a);
  assert.equal(o.total, 180);
  assert.equal(
    (await (await invoke(f, '/api/orders', 'GET', undefined, b)).json()).orders.length,
    0,
  );
  assert.equal((await invoke(f, '/api/orders?scope=staff', 'GET', undefined, a)).status, 403);
  assert.equal(
    (await invoke(f, '/api/orders/' + o.id, 'PATCH', { status: 'Cancelled', revision: 0 }, b))
      .status,
    404,
  );
  assert.equal(
    (await invoke(f, '/api/orders/' + o.id, 'PATCH', { status: 'Preparing', revision: 0 }, a))
      .status,
    400,
  );
  const r = await invoke(
    f,
    '/api/orders/' + o.id,
    'PATCH',
    { status: 'Cancelled', revision: 0 },
    a,
  );
  assert.equal((await r.json()).order.status, 'Cancelled');
});
test('idempotency, concurrent inserts and existing order preservation', async () => {
  const f = fixture(),
    c = await guest(f),
    body = input();
  const [a, b] = await Promise.all([order(f, c, body), order(f, c, body)]);
  assert.equal(a.id, b.id);
  assert.equal((await f.store.get('orders')).rows.length, 1);
  const [x, y] = await Promise.all([order(f, c), order(f, c)]);
  assert.notEqual(x.id, y.id);
  assert.equal((await f.store.get('orders')).rows.length, 3);
});
test('staff authentication, revision conflicts, audit and export', async () => {
  const f = fixture(),
    c = await guest(f),
    o = await order(f, c),
    s = await staff(f);
  assert.equal(
    (await invoke(f, '/api/staff/login', 'POST', { password: 'incorrect' })).status,
    401,
  );
  let r = await invoke(f, '/api/orders/' + o.id, 'PATCH', { status: 'Preparing', revision: 0 }, s);
  assert.equal(r.status, 200);
  assert.equal((await r.json()).order.history.length, 2);
  assert.equal(
    (
      await invoke(
        f,
        '/api/orders/' + o.id,
        'PATCH',
        { status: 'Rejected', reason: 'Sold out', revision: 0 },
        s,
      )
    ).status,
    409,
  );
  r = await invoke(f, '/api/orders/' + o.id, 'PATCH', { status: 'Ready', revision: 1 }, s);
  assert.equal(r.status, 200);
  r = await invoke(f, '/api/orders/' + o.id, 'PATCH', { status: 'Served', revision: 2 }, s);
  assert.equal(r.status, 200);
  r = await invoke(f, '/api/orders/export', 'GET', undefined, s);
  assert.equal((await r.json()).orders[0].status, 'Served');
  assert.equal((await invoke(f, '/api/orders/export', 'GET', undefined, c)).status, 403);
  const out = await invoke(f, '/api/staff/logout', 'POST', {}, s);
  const loggedOut = out.headers.get('set-cookie').split(';')[0];
  assert.equal(
    (await invoke(f, '/api/orders?scope=staff', 'GET', undefined, loggedOut)).status,
    403,
  );
});
test('origin, body and input validation', async () => {
  const f = fixture(),
    c = await guest(f);
  assert.equal(
    (await f.handler(request('/api/orders', 'POST', input(), c, 'https://evil.test'), {})).status,
    403,
  );
  for (const body of [
    { ...input(), table: 13 },
    { ...input(), items: [{ id: 'bad', quantity: 1 }] },
    { ...input(), items: [{ id: '1', quantity: 99 }] },
    { ...input(), note: 'x'.repeat(241) },
  ])
    assert.equal((await invoke(f, '/api/orders', 'POST', body, c)).status, 400);
  assert.equal((await invoke(f, '/api/orders', 'POST', { x: 'a'.repeat(17000) }, c)).status, 413);
});
test('order and login rate limits, missing setup fails closed', async () => {
  const f = fixture(),
    c = await guest(f);
  for (let i = 0; i < 6; i++) await order(f, c);
  assert.equal((await invoke(f, '/api/orders', 'POST', input(), c)).status, 429);
  for (let i = 0; i < 8; i++)
    assert.equal(
      (await invoke(f, '/api/staff/login', 'POST', { password: 'wrong' }, '', '2.2.2.2')).status,
      401,
    );
  assert.equal(
    (await invoke(f, '/api/staff/login', 'POST', { password: 'wrong' }, '', '2.2.2.2')).status,
    429,
  );
  f.env.SESSION_SECRET = '';
  assert.equal((await invoke(f, '/api/me', 'GET')).status, 503);
});
test('conditional write conflict retries and persistent contention reported', async () => {
  const f = fixture(),
    c = await guest(f);
  f.store.conflicts = 2;
  await order(f, c);
  f.store.conflicts = 20;
  assert.equal((await invoke(f, '/api/orders', 'POST', input(), c)).status, 409);
});
