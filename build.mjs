// Builds client.js (the one file DSH loads) from src/*.js, joined in name order. They share one scope: the
// ModuleLoader factory opens in src/00-core.js and closes in src/90-apply.js.
//   node build.mjs          write client.js
//   node build.mjs --check  fail if client.js is not exactly the build of src/ (CI runs this)
import {readdirSync, readFileSync, writeFileSync} from 'node:fs';
const here = new URL('.', import.meta.url).pathname;
const files = readdirSync(here + 'src').filter(f => f.endsWith('.js')).sort();
const out = files.map(f => readFileSync(here + 'src/' + f, 'utf8')).join('');
if (process.argv.includes('--check')) {
  // the release files must be whole and agree on the version (2.2.2 once shipped an empty package.json)
  const pkg = JSON.parse(readFileSync(here + 'package.json', 'utf8')), man = JSON.parse(readFileSync(here + 'manifest.json', 'utf8'));
  const inCode = (out.match(/AMP_VERSION = '([^']+)'/) || [])[1];
  if (!pkg.version || pkg.version !== man.version || pkg.version !== inCode) { console.error(`versions disagree: package ${pkg.version}, manifest ${man.version}, code ${inCode}`); process.exit(1); }
  const cur = readFileSync(here + 'client.js', 'utf8');
  if (cur !== out) { console.error('client.js is not the build of src/: run `node build.mjs`'); process.exit(1); }
  console.log('client.js matches src/ (' + files.join(', ') + ')');
} else { writeFileSync(here + 'client.js', out); console.log('client.js built from', files.length, 'parts'); }
