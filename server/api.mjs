import menu from './menu.json' with { type: 'json' };
import { makeOrder, changeOrder } from './order-logic.mjs';
import {
  HttpError,
  digest,
  readSession,
  newSession,
  sessionCookie,
  sameOrigin,
  bodyJSON,
  passwordMatches,
} from './auth.mjs';
const json = (data, status = 200, extra = {}) =>
  new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
      ...extra,
    },
  });
async function mutate(store, key, initial, fn) {
  for (let attempt = 0; attempt < 8; attempt++) {
    const prior = await store.getWithMetadata(key, { type: 'json', consistency: 'strong' });
    const state = prior?.data || structuredClone(initial);
    const result = fn(state);
    if (result.noWrite) return result.value;
    const written = await store.setJSON(
      key,
      state,
      prior ? { onlyIfMatch: prior.etag } : { onlyIfNew: true },
    );
    if (written.modified) return result.value;
  }
  throw new HttpError(409, 'Another update is in progress. Please retry.');
}
export function createHandler({ getStore, env }) {
  return async function handler(req, context = {}) {
    try {
      const url = new URL(req.url),
        path = url.pathname.replace(/\/$/, ''),
        method = req.method;
      if (!env.SESSION_SECRET || env.SESSION_SECRET.length < 32)
        throw new HttpError(503, 'Ordering setup is incomplete. Please contact the café.');
      const secret = env.SESSION_SECRET,
        session = readSession(req, secret);
      const store = () =>
        getStore({
          name:
            'happy-days-' +
            (env.CONTEXT === 'production'
              ? 'production'
              : env.CONTEXT === 'dev'
                ? 'local'
                : 'preview') +
            '-v1',
          consistency: 'strong',
        });
      if (path === '/api/me' && method === 'GET') {
        if (req.headers.get('sec-fetch-site') === 'cross-site')
          throw new HttpError(403, 'Open the café website directly.');
        const s = session || newSession();
        return json(
          { signedIn: true, staff: s.role === 'staff', mode: 'guest' },
          200,
          session ? {} : { 'Set-Cookie': sessionCookie(req, s, secret) },
        );
      }
      if (method !== 'GET') sameOrigin(req);
      if (path === '/api/staff/login' && method === 'POST') {
        if (!/^scrypt:[a-f0-9]{32}:[a-f0-9]{128}$/.test(env.STAFF_PASSWORD_HASH || ''))
          throw new HttpError(503, 'Staff access has not been configured.');
        const ip = digest('login:' + String(context.ip || 'unknown'), secret),
          now = Date.now();
        await mutate(store(), 'login/' + ip, { attempts: [] }, (s) => {
          s.attempts = s.attempts.filter((t) => t > now - 900000);
          if (s.attempts.length >= 8)
            throw new HttpError(429, 'Too many sign-in attempts. Try again in 15 minutes.');
          s.attempts.push(now);
          return { value: null };
        });
        const input = await bodyJSON(req);
        if (!passwordMatches(input.password, env.STAFF_PASSWORD_HASH))
          throw new HttpError(401, 'Incorrect staff password.');
        return json({ ok: true }, 200, {
          'Set-Cookie': sessionCookie(req, newSession('staff', session?.sid), secret),
        });
      }
      if (path === '/api/staff/logout' && method === 'POST') {
        return json({ ok: true }, 200, {
          'Set-Cookie': sessionCookie(req, newSession('guest', session?.sid), secret),
        });
      }
      if (!session) throw new HttpError(401, 'Enable cookies and reload the ordering page.');
      const staff = session.role === 'staff';
      if (path === '/api/orders' && method === 'GET') {
        const all = url.searchParams.get('scope') === 'staff';
        if (all && !staff) throw new HttpError(403, 'Staff sign-in required.');
        const state = await store().get('orders', { type: 'json', consistency: 'strong' });
        const rows = (state?.rows || [])
          .filter((r) => all || r.owner === session.sid)
          .map((r) => r.order)
          .sort((a, b) => b.created - a.created);
        return json({ orders: rows.slice(0, all ? 300 : 100) });
      }
      if (path === '/api/orders/export' && method === 'GET') {
        if (!staff) throw new HttpError(403, 'Staff sign-in required.');
        const state = await store().get('orders', { type: 'json', consistency: 'strong' });
        return json(
          { exportedAt: new Date().toISOString(), orders: (state?.rows || []).map((r) => r.order) },
          200,
          { 'Content-Disposition': 'attachment; filename="happy-days-orders.json"' },
        );
      }
      if (path === '/api/orders' && method === 'POST') {
        const input = await bodyJSON(req);
        let order;
        try {
          order = { ...makeOrder(menu, input), revision: 0 };
        } catch (e) {
          throw new HttpError(400, e.message);
        }
        const ipHash = digest('order:' + String(context.ip || 'unknown'), secret);
        const result = await mutate(store(), 'orders', { rows: [] }, (s) => {
          const duplicate = s.rows.find((r) => r.requestKey === input.requestKey);
          if (duplicate) {
            if (duplicate.owner !== session.sid)
              throw new HttpError(409, 'Request key already used.');
            return { noWrite: true, value: duplicate.order };
          }
          const recent = s.rows.filter((r) => r.order.created > Date.now() - 60000);
          if (
            recent.filter((r) => r.owner === session.sid).length >= 6 ||
            recent.filter((r) => r.ipHash === ipHash).length >= 30
          )
            throw new HttpError(429, 'Please wait a minute before sending another order.');
          if (s.rows.length >= 10000)
            throw new HttpError(
              503,
              'Online ordering is temporarily at capacity. Please ask staff.',
            );
          s.rows.push({ owner: session.sid, requestKey: input.requestKey, ipHash, order });
          return { value: order };
        });
        return json({ order: result }, 201);
      }
      if (/^\/api\/orders\/HD-[A-F0-9-]+$/.test(path) && method === 'PATCH') {
        const input = await bodyJSON(req),
          id = path.split('/').pop();
        const order = await mutate(store(), 'orders', { rows: [] }, (s) => {
          const row = s.rows.find((r) => r.order.id === id);
          if (!row || (!staff && row.owner !== session.sid))
            throw new HttpError(404, 'Order not found.');
          if (!Number.isInteger(input.revision) || input.revision !== row.order.revision)
            throw new HttpError(409, 'This order changed. Refresh and try again.');
          try {
            row.order = {
              ...changeOrder(
                row.order,
                input.status,
                input.reason,
                staff,
                row.owner === session.sid,
              ),
              revision: row.order.revision + 1,
            };
          } catch (e) {
            throw new HttpError(400, e.message);
          }
          return { value: row.order };
        });
        return json({ order });
      }
      throw new HttpError(404, 'Endpoint not found.');
    } catch (e) {
      if (!(e instanceof HttpError)) console.error('Order API failed:', e.name);
      return json(
        {
          error:
            e instanceof HttpError
              ? e.message
              : 'Order service is temporarily unavailable. Please retry.',
        },
        e instanceof HttpError ? e.status : 503,
      );
    }
  };
}
