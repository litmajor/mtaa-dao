const fs = require('fs');
const path = require('path');

function walk(dir) {
  if (!fs.existsSync(dir)) return [];
  let results = [];
  for (const f of fs.readdirSync(dir)) {
    const fp = path.join(dir, f);
    const stat = fs.statSync(fp);
    if (stat.isDirectory()) results = results.concat(walk(fp));
    else if (/\.(ts|js)$/.test(f)) results.push(fp);
  }
  return results;
}

const files = walk(path.join(__dirname, '..', 'server', 'routes'));
const regex = /(?:\brouter|\bapp)\.(get|post|put|delete|patch|head|options|all)\s*\(/g;
const results = [];
let total = 0;
for (const f of files) {
  try {
    const s = fs.readFileSync(f, 'utf8');
    const matches = s.match(regex);
    const c = matches ? matches.length : 0;
    if (c > 0) results.push({ file: path.relative(process.cwd(), f), count: c });
    total += c;
  } catch (e) {
    // ignore
  }
}
results.sort((a, b) => b.count - a.count);
console.log(JSON.stringify({ total, files: results }, null, 2));
