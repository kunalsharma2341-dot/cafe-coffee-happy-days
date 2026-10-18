import { createInterface } from 'node:readline/promises';
import { stdin, stdout } from 'node:process';
import { existsSync, writeFileSync } from 'node:fs';
import { randomBytes } from 'node:crypto';
import { passwordHash } from '../server/auth.mjs';
if (existsSync('.env')) {
  console.error(
    '.env already exists. Keep it safe. Move it aside first only if you intend to rotate the staff password and invalidate existing sessions.',
  );
  process.exit(1);
}
const rl = createInterface({ input: stdin, output: stdout });
console.log(
  'Local setup: choose a staff password (visible in this terminal; never paste it in chat).',
);
const password = await rl.question('Staff password, 12–256 characters: ');
if (password.length < 12 || password.length > 256) {
  rl.close();
  console.error('Password must be 12–256 characters.');
  process.exit(1);
}
const confirm = await rl.question('Repeat password: ');
rl.close();
if (password !== confirm) {
  console.error('Passwords do not match.');
  process.exit(1);
}
writeFileSync(
  '.env',
  'SESSION_SECRET=' +
    randomBytes(48).toString('hex') +
    '\nSTAFF_PASSWORD_HASH=' +
    passwordHash(password) +
    '\n',
  { mode: 0o600, flag: 'wx' },
);
console.log(
  'Created .env with a password hash and session secret. Keep your chosen password safe. Do not upload .env to GitHub or share it.',
);
