import { createHmac, randomUUID, scryptSync, timingSafeEqual, randomBytes } from 'node:crypto';
export class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}
export function passwordHash(password) {
  const salt = randomBytes(16).toString('hex');
  return 'scrypt:' + salt + ':' + scryptSync(password, salt, 64).toString('hex');
}
export function passwordMatches(password, hash) {
  if (
    typeof password !== 'string' ||
    password.length > 256 ||
    !/^scrypt:[a-f0-9]{32}:[a-f0-9]{128}$/.test(hash || '')
  )
    return false;
  const [, salt, value] = hash.split(':');
  return timingSafeEqual(scryptSync(password, salt, 64), Buffer.from(value, 'hex'));
}
export const digest = (value, secret) =>
  createHmac('sha256', secret).update(value).digest('base64url');
export function sessionCookie(req, session, secret) {
  const body = Buffer.from(JSON.stringify(session)).toString('base64url');
  return (
    'happy_days_session=' +
    body +
    '.' +
    digest(body, secret) +
    '; Path=/; HttpOnly; SameSite=Lax; Max-Age=' +
    Math.max(0, Math.floor((session.exp - Date.now()) / 1000)) +
    (new URL(req.url).protocol === 'https:' ? '; Secure' : '')
  );
}
export function newSession(role = 'guest', sid = randomUUID()) {
  return { sid, role, exp: Date.now() + (role === 'staff' ? 8 * 3600000 : 30 * 86400000) };
}
export function readSession(req, secret) {
  try {
    const raw = (req.headers.get('cookie') || '')
      .split(';')
      .map((x) => x.trim())
      .find((x) => x.startsWith('happy_days_session='))
      ?.slice(19);
    if (!raw || raw.length > 1000) return null;
    const [body, sig, ...rest] = raw.split('.');
    if (rest.length || !body || !sig) return null;
    const expect = digest(body, secret);
    if (sig.length !== expect.length || !timingSafeEqual(Buffer.from(sig), Buffer.from(expect)))
      return null;
    const s = JSON.parse(Buffer.from(body, 'base64url').toString());
    if (
      !/^[a-f0-9-]{36}$/.test(s.sid) ||
      !['guest', 'staff'].includes(s.role) ||
      !Number.isFinite(s.exp) ||
      s.exp <= Date.now()
    )
      return null;
    return s;
  } catch {
    return null;
  }
}
export function sameOrigin(req) {
  const expected = new URL(req.url).origin;
  if (req.headers.get('origin') !== expected)
    throw new HttpError(403, 'Please send requests from this website.');
  if (!/^application\/json(?:;|$)/i.test(req.headers.get('content-type') || ''))
    throw new HttpError(415, 'JSON request required.');
}
export async function bodyJSON(req) {
  if (Number(req.headers.get('content-length')) > 16384)
    throw new HttpError(413, 'Request too large.');
  const reader = req.body?.getReader();
  if (!reader) throw new HttpError(400, 'Request body required.');
  let length = 0,
    chunks = [];
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    length += value.length;
    if (length > 16384) {
      await reader.cancel();
      throw new HttpError(413, 'Request too large.');
    }
    chunks.push(value);
  }
  try {
    const data = JSON.parse(Buffer.concat(chunks).toString());
    if (!data || typeof data !== 'object' || Array.isArray(data)) throw Error();
    return data;
  } catch {
    throw new HttpError(400, 'Invalid request.');
  }
}
