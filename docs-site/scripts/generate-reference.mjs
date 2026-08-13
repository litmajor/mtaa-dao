#!/usr/bin/env node
/**
 * Generates the implementation-derived reference pages under
 * docs-site/pages/reference/ by statically analysing the server, shared
 * schema and Solidity sources.
 *
 * Usage: node docs-site/scripts/generate-reference.mjs
 *
 * Everything it emits is derived from source, never hand-maintained, so the
 * reference section can be regenerated whenever the implementation changes.
 * Static analysis cannot see routes registered through fully dynamic values,
 * so the generated pages state that caveat explicitly.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..', '..');
const OUT = path.join(ROOT, 'docs-site', 'pages', 'reference');

const read = (p) => fs.readFileSync(p, 'utf8');

// Route registrations quoted inside comments (docs blocks, "previously"/"fixed"
// notes) would otherwise be resolved as real mounts.
function stripComments(src) {
  const out = src.split('');
  let i = 0;
  let inString = false;
  let quote = '';
  // Comment bodies are dropped, newlines kept, so reported line numbers hold.
  const drop = (from, to) => {
    for (let k = from; k < to; k += 1) if (out[k] !== '\n') out[k] = '';
  };
  while (i < src.length) {
    const c = src[i];
    const n = src[i + 1];
    if (!inString) {
      if (c === '/' && n === '/') { const s = i; while (i < src.length && src[i] !== '\n') i += 1; drop(s, i); continue; }
      if (c === '/' && n === '*') { const s = i; i += 2; while (i < src.length && !(src[i] === '*' && src[i + 1] === '/')) i += 1; i = Math.min(i + 2, src.length); drop(s, i); continue; }
      if (c === '"' || c === "'" || c === '`') { inString = true; quote = c; }
      i += 1;
      continue;
    }
    if (c === '\\') { i += 2; continue; }
    if (c === quote) inString = false;
    i += 1;
  }
  return out.join('');
}
const rel = (p) => path.relative(ROOT, p).split(path.sep).join('/');

// ───────────────────────────── route resolution ─────────────────────────────

const AUTH_TOKENS = [
  'isAuthenticated', 'authenticate', 'authenticateToken', 'requireAuth', 'verifyAccessToken',
  'requireRole', 'requireDAORole', 'requirePermission', 'requireAdmin', 'requireSuperAdmin',
  'adminAuth', 'authenticateAdmin', 'optionalAuth', 'apiKeyAuth', 'requireApiKey', 'isSuperUser',
];
const MIDDLEWARE = new Set([
  ...AUTH_TOKENS, 'express', 'cors', 'helmet', 'compression', 'rateLimit', 'asyncHandler',
  'csrfProtection', 'validate', 'limiter', 'upload', 'validateRequest',
]);
const NON_ROUTER_OBJECTS = new Set([
  'axios', 'fetch', 'http', 'https', 'client', 'api', 'db', 'redis', 'supertest', 'request', 'page',
]);

const methodRe = /\b(\w+)\s*\.\s*(get|post|put|patch|delete|all)\s*\(\s*(['"`])([^'"`]*)\3\s*,?([^\n]*)/g;
const useStrRe = /\b(\w+)\s*\.\s*use\s*\(\s*(['"`])(\/[^'"`]*)\2\s*,?([^\n;]*)/g;
const useNoPathRe = /\b(\w+)\s*\.\s*use\s*\(\s*([A-Za-z_$][\w$]*)\s*\)/g;
const importDefaultRe = /import\s+(\w+)\s+from\s+['"]([^'"]+)['"]/g;
const importNamedRe = /import\s*\{([^}]*)\}\s*from\s*['"]([^'"]+)['"]/g;
const dynImportRe = /(?:const|let|var)?\s*(\w+)?\s*=?\s*\(await\s+import\(\s*['"]([^'"]+)['"]\s*\)\)\.(\w+)/g;
const inlineUseDynRe = /\.use\(\s*(['"`])(\/[^'"`]*)\1\s*,\s*(?:[\w\s,()]*?)?\(await\s+import\(\s*['"]([^'"]+)['"]\s*\)\)\.(\w+)\s*\)/g;

function resolveModule(importer, spec) {
  if (!spec.startsWith('.')) return null;
  let base = path.normalize(path.join(path.dirname(importer), spec));
  if (base.endsWith('.js')) base = base.slice(0, -3);
  for (const cand of [`${base}.ts`, `${base}.tsx`, path.join(base, 'index.ts')]) {
    if (fs.existsSync(cand) && fs.statSync(cand).isFile()) return cand;
  }
  return null;
}

function moduleImports(file, src) {
  const out = {};
  for (const m of src.matchAll(importDefaultRe)) {
    const f = resolveModule(file, m[2]);
    if (f) out[m[1]] = f;
  }
  for (const m of src.matchAll(importNamedRe)) {
    const f = resolveModule(file, m[2]);
    if (!f) continue;
    for (const raw of m[1].split(',')) {
      const name = raw.trim().split(' as ').pop()?.trim();
      if (name && !(name in out)) out[name] = f;
    }
  }
  for (const m of src.matchAll(dynImportRe)) {
    const f = resolveModule(file, m[2]);
    if (f && m[1]) out[m[1]] = f;
  }
  return out;
}

function authFrom(text) {
  const found = [];
  for (const token of AUTH_TOKENS) {
    for (const m of text.matchAll(new RegExp(`\\b${token}\\b(\\s*\\(([^)]*)\\))?`, 'g'))) {
      const arg = (m[2] || '').trim();
      const label = arg ? `${token}(${arg})` : token;
      if (!found.includes(label)) found.push(label);
    }
  }
  return found;
}

const results = [];
const visited = new Set();

function walk(file, prefix, auth, depth = 0) {
  const key = `${file}|${prefix}|${auth.join(',')}`;
  if (visited.has(key) || depth > 8) return;
  visited.add(key);
  const src = stripComments(read(file));
  const imports = moduleImports(file, src);
  // Router-level middleware applied without a path (`router.use(isAuthenticated, ...)`)
  // guards every route in the file and everything mounted below it.
  const routerAuth = [];
  for (const m of src.matchAll(/\b\w+\s*\.\s*use\s*\(\s*([^'"`)][^\n;]*)\)/g)) {
    for (const a of authFrom(m[1])) if (!auth.includes(a) && !routerAuth.includes(a)) routerAuth.push(a);
  }
  auth = [...auth, ...routerAuth];
  const lines = src.split('\n');
  lines.forEach((line, idx) => {
    for (const m of line.matchAll(methodRe)) {
      const [, obj, method, , routePath, rest = ''] = m;
      // Interpolated strings are cache keys or URLs, never Express route patterns.
      if (NON_ROUTER_OBJECTS.has(obj) || routePath.startsWith('http') || routePath.includes('${')) continue;
      const full = `${prefix.replace(/\/$/, '')}/${routePath.replace(/^\//, '')}`.replace(/\/$/, '') || '/';
      results.push({
        method: method.toUpperCase(),
        path: full,
        auth: [...auth, ...authFrom(rest).filter((a) => !auth.includes(a))],
        file: rel(file),
        line: idx + 1,
      });
    }
  });
  // `export default someImportedRouter` — a pass-through barrel that adds no prefix.
  for (const m of src.matchAll(/export\s+default\s+([A-Za-z_$][\w$]*)\s*;/g)) {
    const target = imports[m[1]];
    if (target && target !== file) walk(target, prefix, auth, depth + 1);
  }
  for (const m of src.matchAll(inlineUseDynRe)) {
    const target = resolveModule(file, m[3]);
    if (target) walk(target, prefix.replace(/\/$/, '') + m[2], [...auth, ...authFrom(m[0]).filter((a) => !auth.includes(a))], depth + 1);
  }
  for (const m of src.matchAll(useStrRe)) {
    const subPrefix = m[3];
    const rest = m[4] || '';
    const idents = [...rest.matchAll(/\b(\w+)\b/g)].map((x) => x[1]).reverse();
    const targetIdent = idents.find((i) => !MIDDLEWARE.has(i) && imports[i]);
    if (targetIdent) {
      walk(imports[targetIdent], prefix.replace(/\/$/, '') + subPrefix,
        [...auth, ...authFrom(rest).filter((a) => !auth.includes(a))], depth + 1);
    }
  }
  for (const m of src.matchAll(useNoPathRe)) {
    const ident = m[2];
    if (imports[ident] && !MIDDLEWARE.has(ident)) walk(imports[ident], prefix, auth, depth + 1);
  }
}

for (const entry of ['server/index.ts', 'server/routes.ts']) walk(path.join(ROOT, entry), '', []);

const byKey = new Map();
for (const r of results) {
  const k = `${r.method} ${r.path}`;
  const prev = byKey.get(k);
  if (!prev || r.auth.length > prev.auth.length) byKey.set(k, r);
}
const endpoints = [...byKey.values()]
  .filter((r) => /^\/(api|walletapi|health|metrics)(\/|$)/.test(r.path))
  .sort((a, b) => (a.path === b.path ? a.method.localeCompare(b.method) : a.path.localeCompare(b.path)));

// ───────────────────────────── drizzle schema ─────────────────────────────

const tblRe = /export\s+const\s+(\w+)\s*=\s*pgTable\(\s*(['"`])([^'"`]+)\2/g;
const colRe = /^\s*(\w+)\s*:\s*(\w+)\(([^)]*)\)(.*)$/;
const tables = {};
const sharedDir = path.join(ROOT, 'shared');
for (const f of fs.readdirSync(sharedDir).sort()) {
  if (!f.endsWith('.ts')) continue;
  const p = path.join(sharedDir, f);
  const src = read(p);
  const lines = src.split('\n');
  for (const m of src.matchAll(tblRe)) {
    const start = src.slice(0, m.index).split('\n').length - 1;
    const columns = [];
    for (let i = start + 1; i < Math.min(start + 400, lines.length); i++) {
      if (/^\s*\}\)/.test(lines[i])) break;
      const cm = colRe.exec(lines[i]);
      if (cm) {
        columns.push({
          name: cm[1], type: cm[2], args: cm[3].trim(),
          mods: cm[4].trim().replace(/,$/, '').split('//')[0].trim(),
        });
      }
    }
    tables[m[3]] = { variable: m[1], file: rel(p), line: start + 1, columns };
  }
}

// ───────────────────────────── solidity contracts ─────────────────────────────

const contractRe = /^\s*(abstract\s+)?(contract|interface|library)\s+(\w+)([^{]*)\{/gm;
const fnRe = /^\s*function\s+(\w+)\s*\(([^)]*)\)\s*([^{;]*)/gm;
const evRe = /^\s*event\s+(\w+)\s*\(([^)]*)\)/gm;
const roleRe = /bytes32\s+public\s+constant\s+(\w+)\s*=/g;
const contracts = {};
function walkSol(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
    const p = path.join(dir, entry.name);
    if (entry.isDirectory()) walkSol(p);
    else if (entry.name.endsWith('.sol')) {
      const src = read(p);
      contracts[rel(p)] = {
        pragma: (/pragma solidity ([^;]+);/.exec(src) || [])[1]?.trim() ?? null,
        lines: src.split('\n').length,
        declarations: [...src.matchAll(contractRe)].map((m) => ({ kind: m[2], name: m[3], inherits: m[4].trim() })),
        functions: [...src.matchAll(fnRe)].map((m) => ({ name: m[1], params: m[2].trim().replace(/\s+/g, ' '), mods: m[3].split(/\s+/).filter(Boolean).join(' ') })),
        events: [...src.matchAll(evRe)].map((m) => ({ name: m[1], params: m[2].trim().replace(/\s+/g, ' ') })),
        roles: [...new Set([...src.matchAll(roleRe)].map((m) => m[1]))],
      };
    }
  }
}
walkSol(path.join(ROOT, 'contracts'));

// ───────────────────────────── emit MDX ─────────────────────────────

const VERIFIED = new Date().toISOString().slice(0, 10);
const esc = (s) => String(s).replace(/\|/g, '\\|').replace(/</g, '&lt;').replace(/\{/g, '&#123;').replace(/\}/g, '&#125;');

function frontmatter(title, description, audience) {
  return `---\ntitle: ${title}\ndescription: ${description}\naudience: ${audience}\nstatus: IMPLEMENTED\nsource: generated by docs-site/scripts/generate-reference.mjs\nlast_verified: ${VERIFIED}\n---\n\n`;
}

const GENERATED_NOTE = (cmd) => `import { Callout } from 'nextra/components'

<Callout type="info">
  This page is generated from source by \`${cmd}\`. Do not edit it by hand — rerun the
  generator instead. It reflects statically resolvable registrations only; a handful of
  registrations built from fully dynamic values cannot be resolved statically and are
  therefore absent.
</Callout>
`;

fs.mkdirSync(path.join(OUT, 'api'), { recursive: true });

// Group endpoints into domains.
function domainOf(p) {
  const parts = p.replace(/^\//, '').split('/');
  if (parts[0] === 'walletapi') return 'wallets';
  if (parts[1] === 'v1') return parts[2] || 'v1';
  return parts[1] || parts[0];
}
const DOMAIN_GROUPS = {
  identity: ['auth', 'user', 'users', 'account', 'accounts', 'profile', 'kyc', 'onboarding', 'settings', 'user-follows', 'invitations', 'sessions'],
  dao: ['daos', 'dao', 'governance', 'proposal-execution', 'reputation', 'challenges', 'tasks', 'task-templates', 'achievements', 'contributions', 'proof-of-contribution', 'announcements', 'events', 'success-stories'],
  treasury: ['wallets', 'treasury', 'treasury-management', 'multisig', 'escrow', 'payments', 'payment-gateway', 'payment-requests', 'deposits-withdrawals', 'invoices', 'p2p-transfers', 'disbursements', 'economy', 'revenue', 'referrals', 'referral-rewards', 'subscription-management', 'user-subscription'],
  trading: ['yuki', 'trading', 'market', 'execution', 'exchanges', 'strategies', 'bots', 'dex', 'symbol-universe', 'simulation', 'nft-marketplace'],
  agents: ['agents', 'morio', 'personas', 'analyzer', 'synchronizer', 'defender', 'propagation', 'rules'],
  platform: ['admin', 'health', 'monitoring', 'logs', 'jobs', 'system', 'diagnostics', 'websocket-monitoring', 'control-plane', 'features', 'docs', 'analytics', 'dashboard', 'notifications', 'support', 'telegram'],
};
const groupOf = (d) => Object.entries(DOMAIN_GROUPS).find(([, ds]) => ds.includes(d))?.[0] ?? 'other';

const grouped = new Map();
for (const e of endpoints) {
  const g = groupOf(domainOf(e.path));
  if (!grouped.has(g)) grouped.set(g, []);
  grouped.get(g).push(e);
}

const GROUP_TITLES = {
  identity: 'Identity & Accounts',
  dao: 'DAO & Governance',
  treasury: 'Treasury, Wallets & Payments',
  trading: 'Trading & Market Data',
  agents: 'Agents & Automation',
  platform: 'Platform & Operations',
  other: 'Other Surfaces',
};

function endpointTable(list) {
  const rows = list.map((e) => `| \`${e.method}\` | \`${esc(e.path)}\` | ${e.auth.length ? e.auth.map((a) => `\`${esc(a)}\``).join(' ') : '— *(none detected)*'} | \`${e.file}:${e.line}\` |`);
  return ['| Method | Path | Auth / authorization middleware | Source |', '| --- | --- | --- | --- |', ...rows].join('\n');
}

for (const [group, list] of grouped) {
  const title = GROUP_TITLES[group];
  const byDomain = new Map();
  for (const e of list) {
    const d = domainOf(e.path);
    if (!byDomain.has(d)) byDomain.set(d, []);
    byDomain.get(d).push(e);
  }
  const sections = [...byDomain.entries()]
    .sort((a, b) => b[1].length - a[1].length)
    .map(([d, es]) => `## ${d} (${es.length})\n\n${endpointTable(es)}\n`);
  fs.writeFileSync(path.join(OUT, 'api', `${group}.mdx`),
    frontmatter(title, `Statically resolved HTTP endpoints for the ${title.toLowerCase()} surface.`, 'developers, builders') +
    GENERATED_NOTE('node docs-site/scripts/generate-reference.mjs') +
    `\n# ${title} endpoints\n\n${list.length} statically resolved endpoints.\n\n${sections.join('\n')}`);
}

const totals = [...grouped.entries()].map(([g, l]) => `| [${GROUP_TITLES[g]}](/reference/api/${g}) | ${l.length} | ${l.filter((e) => e.auth.length).length} |`).join('\n');
fs.writeFileSync(path.join(OUT, 'api', 'index.mdx'),
  frontmatter('API endpoint index', 'Every HTTP endpoint resolvable from the Express route graph.', 'developers, builders') +
  GENERATED_NOTE('node docs-site/scripts/generate-reference.mjs') +
  `\n# API endpoint index\n\nResolved by walking \`server/index.ts\` and \`server/routes.ts\` and following every\n\`app.use\`/\`router.use\` mount.\n\n- **Total endpoints:** ${endpoints.length}\n- **With auth/authorization middleware detected on the chain:** ${endpoints.filter((e) => e.auth.length).length}\n- **Without detected auth middleware:** ${endpoints.filter((e) => !e.auth.length).length}\n\n| Surface | Endpoints | With auth middleware |\n| --- | --- | --- |\n${totals}\n\nThe "without detected auth" figure is an upper bound on public endpoints: some routers\nauthenticate inside the handler rather than through middleware, which static analysis\ncannot see. Treat it as a review list, not a list of public endpoints.\n`);

fs.writeFileSync(path.join(OUT, 'api', '_meta.json'), `${JSON.stringify({
  index: 'Index',
  identity: 'Identity & Accounts',
  dao: 'DAO & Governance',
  treasury: 'Treasury & Payments',
  trading: 'Trading & Market Data',
  agents: 'Agents & Automation',
  platform: 'Platform & Operations',
  ...(grouped.has('other') ? { other: 'Other Surfaces' } : {}),
}, null, 2)}\n`);

// Database reference
const tableNames = Object.keys(tables).sort();
const byFile = new Map();
for (const name of tableNames) {
  const f = tables[name].file;
  if (!byFile.has(f)) byFile.set(f, []);
  byFile.get(f).push(name);
}
const dbSections = [...byFile.entries()].sort().map(([f, names]) => {
  const rows = names.map((n) => {
    const t = tables[n];
    const pk = t.columns.filter((c) => c.mods.includes('primaryKey')).map((c) => c.name).join(', ') || '—';
    const fks = t.columns.filter((c) => c.mods.includes('references')).length;
    return `| \`${n}\` | ${t.columns.length} | ${esc(pk)} | ${fks} | \`${t.file}:${t.line}\` |`;
  });
  return `## \`${f}\` (${names.length} tables)\n\n| Table | Columns | Primary key | FK columns | Source |\n| --- | --- | --- | --- | --- |\n${rows.join('\n')}\n`;
});
fs.writeFileSync(path.join(OUT, 'database.mdx'),
  frontmatter('Database schema reference', 'Every Drizzle pgTable defined in shared/.', 'developers') +
  GENERATED_NOTE('node docs-site/scripts/generate-reference.mjs') +
  `\n# Database schema reference\n\n- **Tables:** ${tableNames.length}\n- **Columns:** ${tableNames.reduce((n, t) => n + tables[t].columns.length, 0)}\n- **Schema files:** ${byFile.size} (all under \`shared/\`)\n- **Migration tool:** \`drizzle-kit push\` (\`npm run db:push\`)\n\n${dbSections.join('\n')}`);

// Contracts reference
const solFiles = Object.keys(contracts).sort();
const contractCount = solFiles.reduce((n, f) => n + contracts[f].declarations.filter((d) => d.kind === 'contract').length, 0);
const contractRows = solFiles.map((f) => {
  const c = contracts[f];
  const names = c.declarations.map((d) => `${d.name}${d.kind === 'interface' ? ' *(interface)*' : d.kind === 'library' ? ' *(library)*' : ''}`).join(', ') || '—';
  return `| \`${f}\` | ${esc(names)} | ${c.functions.length} | ${c.events.length} | ${c.pragma ? `\`${c.pragma}\`` : '—'} | ${c.lines} |`;
});
const detail = solFiles.filter((f) => contracts[f].declarations.some((d) => d.kind === 'contract')).map((f) => {
  const c = contracts[f];
  const decl = c.declarations.map((d) => `- \`${d.kind} ${d.name}\`${d.inherits ? ` ${esc(d.inherits)}` : ''}`).join('\n');
  const fns = c.functions.length
    ? `\n**Functions**\n\n| Function | Parameters | Modifiers / returns |\n| --- | --- | --- |\n${c.functions.map((fn) => `| \`${fn.name}\` | ${fn.params ? `\`${esc(fn.params)}\`` : '—'} | ${fn.mods ? `\`${esc(fn.mods)}\`` : '—'} |`).join('\n')}\n`
    : '';
  const evs = c.events.length ? `\n**Events**\n\n${c.events.map((e) => `- \`${e.name}(${esc(e.params)})\``).join('\n')}\n` : '';
  const roles = c.roles.length ? `\n**Role constants:** ${c.roles.map((r) => `\`${r}\``).join(', ')}\n` : '';
  return `## \`${f}\`\n\n${decl}\n${roles}${fns}${evs}`;
});
fs.writeFileSync(path.join(OUT, 'contracts.mdx'),
  frontmatter('Smart contract reference', 'Solidity sources in contracts/, their functions, events and roles.', 'developers') +
  GENERATED_NOTE('node docs-site/scripts/generate-reference.mjs') +
  `\n# Smart contract reference\n\n- **Solidity files:** ${solFiles.length}\n- **\`contract\` declarations:** ${contractCount}\n- **Compiler:** Hardhat (\`npm run contracts:compile\`)\n\nDeployment addresses are **not** documented here: no address registry is committed to the\nrepository, so no deployment can be verified from source.\n\n## File inventory\n\n| File | Declarations | Functions | Events | Pragma | Lines |\n| --- | --- | --- | --- | --- | --- |\n${contractRows.join('\n')}\n\n${detail.join('\n')}`);

console.log(`endpoints: ${endpoints.length}`);
console.log(`tables: ${tableNames.length}`);
console.log(`solidity files: ${solFiles.length}, contracts: ${contractCount}`);
