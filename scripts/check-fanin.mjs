import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// Usage: node scripts/check-fanin.mjs path/to/file1.ts path/to/file2.ts ...
// Reports fan-in (who imports this file) and fan-out (what this file imports)
// for specific files, using the same import-resolution logic as
// architecture-report.mjs. Useful for deciding which file in a suspected
// duplicate pair is actually live before deleting either one.

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '..');

const targets = process.argv.slice(2);
if (targets.length === 0) {
  console.error('Usage: node scripts/check-fanin.mjs <file1> <file2> ...');
  process.exit(1);
}

const DEFAULT_EXCLUDED_DIRS = new Set([
  'node_modules', 'dist', 'build', 'out', 'coverage', '.git', '.next',
  '.turbo', '.cache', 'cache', 'artifacts', '__pycache__', 'venv', '.venv',
  'target', 'vendor', 'visibility',
]);

function walk(dir, collected = []) {
  let entries;
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return collected;
  }
  entries.forEach((entry) => {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (DEFAULT_EXCLUDED_DIRS.has(entry.name)) return;
      walk(fullPath, collected);
      return;
    }
    collected.push(fullPath);
  });
  return collected;
}

function isSourceFile(filePath) {
  return /\.(ts|tsx|js|jsx|mjs|cjs|py|sol)$/.test(filePath);
}

function toRel(filePath) {
  return path.relative(repoRoot, filePath).replace(/\\/g, '/');
}

function resolveImportPath(fromFile, specifier) {
  if (!specifier || (!specifier.startsWith('.') && !specifier.startsWith('/'))) {
    return null;
  }
  const basePath = specifier.startsWith('/')
    ? path.join(repoRoot, specifier.slice(1))
    : path.resolve(path.dirname(fromFile), specifier);

  const candidates = [
    basePath, `${basePath}.ts`, `${basePath}.tsx`, `${basePath}.js`,
    `${basePath}.jsx`, `${basePath}.mjs`, `${basePath}.cjs`, `${basePath}.sol`,
    path.join(basePath, 'index.ts'), path.join(basePath, 'index.tsx'),
    path.join(basePath, 'index.js'), path.join(basePath, 'index.jsx'),
  ];
  return candidates.find((c) => fs.existsSync(c) && fs.statSync(c).isFile()) || null;
}

function getImportSpecifiers(content) {
  const specifiers = [];
  const regexes = [
    /(?:import|export)\s+(?:[^'";]*?\s+from\s+)?['"]([^'"]+)['"]/g,
    /import\(\s*['"]([^'"]+)['"]\s*\)/g,
    /require\(\s*['"]([^'"]+)['"]\s*\)/g,
  ];
  regexes.forEach((regex) => {
    for (const match of content.matchAll(regex)) specifiers.push(match[1]);
  });
  return [...new Set(specifiers)];
}

const allFiles = walk(repoRoot).filter(isSourceFile);

const resolvedTargets = targets.map((t) => {
  const abs = path.isAbsolute(t) ? t : path.join(repoRoot, t);
  if (!fs.existsSync(abs)) {
    console.error(`Warning: ${t} not found at ${abs} — skipping`);
    return null;
  }
  return abs;
}).filter(Boolean);

const targetSet = new Set(resolvedTargets);
const importsByFile = new Map();
const importersByTarget = new Map(resolvedTargets.map((t) => [t, []]));

allFiles.forEach((file) => {
  const content = fs.readFileSync(file, 'utf8');
  const deps = getImportSpecifiers(content)
    .map((spec) => resolveImportPath(file, spec))
    .filter(Boolean);
  importsByFile.set(file, deps);
  deps.forEach((dep) => {
    if (targetSet.has(dep)) {
      importersByTarget.get(dep).push(toRel(file));
    }
  });
});

console.log('');
resolvedTargets.forEach((target) => {
  const importers = importersByTarget.get(target);
  const fanOut = (importsByFile.get(target) || []).length;
  console.log(`${toRel(target)}`);
  console.log(`  fanIn:  ${importers.length}${importers.length ? ' — imported by: ' + importers.slice(0, 10).join(', ') + (importers.length > 10 ? ` (+${importers.length - 10} more)` : '') : ' — nothing in the scanned tree imports this'}`);
  console.log(`  fanOut: ${fanOut}`);
  console.log('');
});
