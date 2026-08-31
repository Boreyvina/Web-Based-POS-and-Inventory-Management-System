/**
 * Generate a bcrypt hash for a password.
 * Usage:  node scripts/hash.js admin123
 */
const bcrypt = require('bcryptjs');
const password = process.argv[2];
if (!password) {
  console.error('Usage: node scripts/hash.js <password>');
  process.exit(1);
}
console.log(bcrypt.hashSync(password, 10));
