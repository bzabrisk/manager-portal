// Prints the bcrypt hash of a password, and nothing else.
//
//   npm run hash-password -- "the password here"
//
// Paste the output into the PORTAL_PASSWORD_HASH variable in Railway.
// See SECURITY.md for the full rotation procedure.

import bcrypt from 'bcrypt';

const COST_FACTOR = 12;

const password = process.argv[2];
if (typeof password !== 'string' || password.length === 0) {
  process.stderr.write('Usage: npm run hash-password -- "the password here"\n');
  process.exit(1);
}

process.stdout.write(await bcrypt.hash(password, COST_FACTOR) + '\n');
