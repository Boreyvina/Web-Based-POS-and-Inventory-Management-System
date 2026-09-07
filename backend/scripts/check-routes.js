/**
 * Catches the class of bug where a route points at a controller function that
 * does not exist. Express only complains when the file loads, and the message
 * ("requires a callback function but got undefined") does not say which name is
 * missing. This does.
 *
 *   npm run check
 */
const fs = require('fs');
const path = require('path');

const SRC = path.join(__dirname, '..', 'src');
const exportsOf = (file) =>
  new Set([...fs.readFileSync(file, 'utf8').matchAll(/^exports\.(\w+)/gm)].map((m) => m[1]));

let failures = 0;

for (const name of fs.readdirSync(path.join(SRC, 'routes')).sort()) {
  if (!name.endsWith('.js') || name === 'index.js') continue;
  const text = fs.readFileSync(path.join(SRC, 'routes', name), 'utf8');

  for (const [alias, dir, pattern] of [
    ['ctrl', 'controllers', /ctrl\.(\w+)/g],
    ['v', 'validators', /\bv\.(\w+)/g],
  ]) {
    const req = text.match(new RegExp(`require\\('\\.\\./${dir}/([^']+)'\\)`));
    if (!req) continue;

    const target = path.join(SRC, dir, `${req[1]}.js`);
    if (!fs.existsSync(target)) {
      console.error(`  MISSING FILE  ${name} -> ${dir}/${req[1]}.js`);
      failures += 1;
      continue;
    }

    const available = exportsOf(target);
    const used = new Set([...text.matchAll(pattern)].map((m) => m[1]));
    const missing = [...used].filter((u) => !available.has(u));

    if (missing.length) {
      console.error(`  MISSING       ${name} uses ${alias}.${missing.join(`, ${alias}.`)}` +
                    ` but ${dir}/${req[1]}.js does not export ${missing.length > 1 ? 'them' : 'it'}`);
      failures += missing.length;
    }
  }
}

if (failures) {
  console.error(`\n${failures} broken reference${failures === 1 ? '' : 's'}. The server would crash on startup.\n`);
  process.exit(1);
}
console.log('All routes point at handlers that exist.');
