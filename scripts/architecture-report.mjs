import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '..');

// ---------------------------------------------------------------------------
// CHANGES FROM PREVIOUS VERSION
//
// 1. BUG FIX (totals/complexity scope mismatch): `totals`, `topFiles`, and
//    `complexity` used to be derived from `summary`, which was silently
//    sliced to the 80 largest files. Meanwhile `routeOwnership` and
//    `boundedContexts` ran over the FULL file list. This produced a report
//    where `totals.files` (80) had nothing to do with the file counts implied
//    by `contextClusters` (hundreds). Totals, complexity, and duplicate
//    detection now all run over the same full `relevant` set. `topFiles`
//    remains a top-80-by-lines VIEW, clearly labeled as a view, not a total.
//
// 2. ROOT AUTO-DISCOVERY: previously `scanRoots` was hardcoded to
//    ['server', 'src', 'app']. This now discovers every top-level directory
//    in the repo automatically (excluding vendor/build noise), so nothing
//    at the repo root is silently skipped just because it wasn't named in
//    an array. Override with the ROOTS env var (comma-separated) if you
//    ever want to scope it back down.
//
// 3. UNCLASSIFIED BUCKET: `inferContext` previously defaulted anything
//    that didn't match governance/treasury/payments/trading/identity
//    keywords into 'observability-and-control'. That silently inflated one
//    bucket with unrelated features (chat, tasks, blog, messaging) and made
//    it look like a real architectural finding. Non-matches now go to an
//    explicit 'unclassified' bucket instead, so the report doesn't
//    manufacture false confidence about your domain boundaries.
//
// 4. SOLIDITY SUPPORT: contracts (.sol) are now scanned and included in
//    import-graph resolution, since contracts are core to this codebase,
//    not just server/src/app.
//
// 5. DUPLICATE / NEAR-DUPLICATE FILE DETECTION: flags likely-duplicate
//    files by (a) same normalized base name after stripping suffixes like
//    "_fixed", ".updated", "_v2", and (b) small edit-distance between base
//    names sharing an extension (catches typo'd duplicates like
//    layerZeroRouterBridge.ts / laterZeroRouterBridge.ts). This is a
//    cheap, mechanical check — it flags candidates, it doesn't decide
//    which file is the one to keep. Verify with fan-in before deleting
//    anything.
// ---------------------------------------------------------------------------

const DEFAULT_EXCLUDED_DIRS = new Set([
  'node_modules', 'dist', 'build', 'out', 'coverage', '.git', '.next',
  '.turbo', '.cache', 'cache', 'artifacts', // hardhat build output
  '__pycache__', 'venv', '.venv', 'target', 'vendor', 'visibility',
]);

const boundedContextNames = [
  'dao-governance',
  'treasury-and-vaults',
  'payments-and-recovery',
  'trading-and-market-data',
  'identity-and-access',
  'observability-and-control',
  'unclassified',
];

function discoverRoots() {
  const override = process.env.ROOTS;
  if (override) {
    return override.split(',').map((s) => s.trim()).filter(Boolean);
  }
  return fs.readdirSync(repoRoot, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .filter((name) => !name.startsWith('.'))
    .filter((name) => !DEFAULT_EXCLUDED_DIRS.has(name));
}

const scanRoots = discoverRoots();

function walk(dir, collected = []) {
  let entries;
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return collected; // unreadable dir (permissions, broken symlink) — skip, don't crash the whole scan
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

function formatBytes(bytes) {
  return `${(bytes / 1024).toFixed(1)} KB`;
}

function getLineCount(filePath) {
  return fs.readFileSync(filePath, 'utf8').split(/\r?\n/).length;
}

function toRel(filePath) {
  return path.relative(repoRoot, filePath).replace(/\\/g, '/');
}

function isSourceFile(filePath) {
  return /\.(ts|tsx|js|jsx|mjs|cjs|py|sol)$/.test(filePath);
}

function isRelevantFile(filePath) {
  const rel = toRel(filePath);
  return scanRoots.some((root) => rel === root || rel.startsWith(`${root}/`));
}

function resolveImportPath(fromFile, specifier) {
  if (!specifier || (!specifier.startsWith('.') && !specifier.startsWith('/'))) {
    return null;
  }

  const basePath = specifier.startsWith('/')
    ? path.join(repoRoot, specifier.slice(1))
    : path.resolve(path.dirname(fromFile), specifier);

  const candidates = [
    basePath,
    `${basePath}.ts`,
    `${basePath}.tsx`,
    `${basePath}.js`,
    `${basePath}.jsx`,
    `${basePath}.mjs`,
    `${basePath}.cjs`,
    `${basePath}.sol`,
    path.join(basePath, 'index.ts'),
    path.join(basePath, 'index.tsx'),
    path.join(basePath, 'index.js'),
    path.join(basePath, 'index.jsx'),
    path.join(basePath, 'index.mjs'),
    path.join(basePath, 'index.cjs'),
  ];

  return candidates.find((candidate) => fs.existsSync(candidate) && fs.statSync(candidate).isFile()) || null;
}

function getImportSpecifiers(content) {
  const specifiers = [];
  const regexes = [
    /(?:import|export)\s+(?:[^'";]*?\s+from\s+)?['"]([^'"]+)['"]/g,
    /import\(\s*['"]([^'"]+)['"]\s*\)/g,
    /require\(\s*['"]([^'"]+)['"]\s*\)/g,
  ];

  regexes.forEach((regex) => {
    for (const match of content.matchAll(regex)) {
      specifiers.push(match[1]);
    }
  });

  return [...new Set(specifiers)];
}

function buildDependencies(files) {
  const importsByFile = new Map(files.map((file) => [file, []]));
  const importersByFile = new Map(files.map((file) => [file, []]));
  const fileSet = new Set(files);

  files.forEach((file) => {
    const content = fs.readFileSync(file, 'utf8');
    const resolvedDependencies = getImportSpecifiers(content)
      .map((specifier) => resolveImportPath(file, specifier))
      .filter((candidate) => candidate && fileSet.has(candidate));

    const uniqueDependencies = [...new Set(resolvedDependencies)];
    importsByFile.set(file, uniqueDependencies);

    uniqueDependencies.forEach((dependencyFile) => {
      const importers = importersByFile.get(dependencyFile) || [];
      importers.push(file);
      importersByFile.set(dependencyFile, importers);
    });
  });

  return { importsByFile, importersByFile };
}

function inferContext(filePath, routePath = '') {
  const haystack = `${toRel(filePath)} ${routePath}`.toLowerCase();

  if (/(governance|proposal|vote|delegate|policy)/.test(haystack)) {
    return 'dao-governance';
  }
  if (/(vault|treasury|wallet|escrow|disburse|yield|multisig)/.test(haystack)) {
    return 'treasury-and-vaults';
  }
  if (/(payment|stripe|billing|refund|reconcil|recovery|mpesa|invoice|compensat)/.test(haystack)) {
    return 'payments-and-recovery';
  }
  if (/(trade|market|dex|exchange|signal|price|routing|order|analytics)/.test(haystack)) {
    return 'trading-and-market-data';
  }
  if (/(auth|session|profile|identity|permission|security|passport|token|user)/.test(haystack)) {
    return 'identity-and-access';
  }
  if (/(metric|monitor|health|log|audit|alert|diagnostic|websocket|middleware|job|worker|queue|cache)/.test(haystack)) {
    return 'observability-and-control';
  }

  // Previously this fell through to 'observability-and-control' by default,
  // which silently inflated that bucket with unrelated files (blog, chat,
  // tasks, messaging). Being honest about "we don't have a keyword match"
  // is more useful than a confident-looking wrong answer.
  return 'unclassified';
}

function buildRouteOwnership(files) {
  return files
    .map((file) => {
      const rel = toRel(file);
      const content = fs.readFileSync(file, 'utf8');
      const routes = [...content.matchAll(/(?:router|app|publicRouter|adminRouter|protectedRouter|apiRouter)\.(get|post|put|delete|patch|options|head)\(\s*(['"`])([^'"`]+)\2/g)]
        .map((match) => match[3])
        .filter(Boolean);

      if (!routes.length) {
        return null;
      }

      return {
        file: rel,
        owner: inferContext(file, routes[0]),
        routeCount: routes.length,
        sampleRoutes: routes.slice(0, 5),
      };
    })
    .filter(Boolean)
    .sort((a, b) => (b.routeCount - a.routeCount) || a.file.localeCompare(b.file));
}

function buildBoundedContexts(files) {
  const grouped = new Map(boundedContextNames.map((name) => [name, {
    name,
    files: [],
    routeCount: 0,
    lines: 0,
  }]));

  files.forEach((file) => {
    const rel = toRel(file);
    const lines = getLineCount(file);
    const context = inferContext(file);
    const bucket = grouped.get(context);
    if (!bucket) return;

    const content = fs.readFileSync(file, 'utf8');
    const routeCount = [...content.matchAll(/(?:router|app|publicRouter|adminRouter|protectedRouter|apiRouter)\.(get|post|put|delete|patch|options|head)\(\s*(['"`])([^'"`]+)\2/g)].length;

    bucket.files.push(rel);
    bucket.routeCount += routeCount;
    bucket.lines += lines;
  });

  return [...grouped.values()]
    .filter((bucket) => bucket.files.length > 0)
    .sort((a, b) => (b.files.length - a.files.length) || a.name.localeCompare(b.name));
}

// --- Duplicate / near-duplicate file detection -----------------------------

function normalizeBaseName(fileName) {
  const ext = path.extname(fileName);
  let base = path.basename(fileName, ext).toLowerCase();
  base = base
    .replace(/[_.\-]?fixed$/, '')
    .replace(/[_.\-]?updated$/, '')
    .replace(/[_.\-]?copy$/, '')
    .replace(/[_.\-]?old$/, '')
    .replace(/[_.\-]?new$/, '')
    .replace(/[_.\-]?backup$/, '')
    .replace(/[_.\-]?deprecated$/, '')
    .replace(/[_.\-]?v\d+$/, '')
    .replace(/[_.\-]?\d+$/, '');
  return { base, ext };
}

function levenshtein(a, b) {
  if (a === b) return 0;
  const dp = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)]);
  for (let j = 0; j <= b.length; j += 1) dp[0][j] = j;
  for (let i = 1; i <= a.length; i += 1) {
    for (let j = 1; j <= b.length; j += 1) {
      dp[i][j] = a[i - 1] === b[j - 1]
        ? dp[i - 1][j - 1]
        : 1 + Math.min(dp[i - 1][j - 1], dp[i - 1][j], dp[i][j - 1]);
    }
  }
  return dp[a.length][b.length];
}

function buildDuplicateCandidates(files) {
  const exactGroups = new Map(); // normalized base+ext -> [rel paths]
  const entries = files.map((file) => {
    const rel = toRel(file);
    const { base, ext } = normalizeBaseName(path.basename(file));
    return { rel, base, ext, rawBase: path.basename(file, ext).toLowerCase() };
  });

  entries.forEach((entry) => {
    const key = `${entry.base}${entry.ext}`;
    if (!exactGroups.has(key)) exactGroups.set(key, []);
    exactGroups.get(key).push(entry.rel);
  });

  const suffixMatches = [...exactGroups.values()]
    .filter((group) => group.length > 1)
    .map((group) => ({ type: 'suffix-normalized', files: group.sort() }));

  // Near-duplicate: same extension, similar length, small edit distance.
  // O(n^2) on raw base names — fine for a few thousand files, guarded by a
  // cheap length-difference prune before running full Levenshtein.
  const byExt = new Map();
  entries.forEach((entry) => {
    if (!byExt.has(entry.ext)) byExt.set(entry.ext, []);
    byExt.get(entry.ext).push(entry);
  });

  const fuzzyMatches = [];
  const seenPairs = new Set();
  byExt.forEach((group) => {
    for (let i = 0; i < group.length; i += 1) {
      for (let j = i + 1; j < group.length; j += 1) {
        const a = group[i];
        const b = group[j];
        if (Math.abs(a.rawBase.length - b.rawBase.length) > 3) continue;
        if (a.rawBase.length < 6 || b.rawBase.length < 6) continue; // skip short names, too noisy
        const dist = levenshtein(a.rawBase, b.rawBase);
        if (dist > 0 && dist <= 2) {
          const key = [a.rel, b.rel].sort().join('|');
          if (seenPairs.has(key)) continue;
          seenPairs.add(key);
          fuzzyMatches.push({ type: 'fuzzy-name', files: [a.rel, b.rel].sort(), editDistance: dist });
        }
      }
    }
  });

  return [...suffixMatches, ...fuzzyMatches];
}

function buildSummary(complexity, boundedContexts, routeOwnership, totals) {
  const biggestHotspots = complexity
    .slice(0, 8)
    .map((item) => ({
      file: item.file,
      lines: item.lines,
      coupling: item.coupling,
      fanIn: item.fanIn,
      fanOut: item.fanOut,
    }));

  const contextClusters = boundedContexts
    .slice(0, boundedContextNames.length)
    .map((bucket) => ({
      context: bucket.name,
      files: bucket.files.length,
      routes: bucket.routeCount,
      lines: bucket.lines,
    }));

  const routeHotspots = routeOwnership
    .slice(0, 8)
    .map((item) => ({
      file: item.file,
      owner: item.owner,
      routeCount: item.routeCount,
    }));

  return {
    totals,
    biggestHotspots,
    contextClusters,
    routeHotspots,
    headline: `${biggestHotspots[0]?.file || 'n/a'} is the largest hotspot by coupling, while ${contextClusters[0]?.context || 'n/a'} is the largest context cluster by file count.`,
  };
}

function buildReport() {
  const allFiles = walk(repoRoot).filter(isSourceFile);
  const relevant = allFiles.filter(isRelevantFile);

  // Full-scope totals — every scanned file, not a top-N slice.
  const fileStats = relevant.map((file) => ({
    file: toRel(file),
    lines: getLineCount(file),
    bytes: fs.statSync(file).size,
  }));

  const totals = {
    files: fileStats.length,
    lines: fileStats.reduce((sum, item) => sum + item.lines, 0),
    bytes: fileStats.reduce((sum, item) => sum + item.bytes, 0),
  };

  // topFiles is explicitly a VIEW (top 80 by line count), not the totals.
  const topFiles = [...fileStats]
    .sort((a, b) => b.lines - a.lines)
    .slice(0, 80)
    .map((item) => ({ file: item.file, lines: item.lines, size: formatBytes(item.bytes) }));

  const { importsByFile, importersByFile } = buildDependencies(relevant);

  // Complexity now runs over ALL relevant files, not just the top-80-by-lines
  // subset — a small file with high fan-in (a real hub) would previously
  // never surface if it wasn't also one of the 80 longest files.
  const complexity = fileStats
    .map((item) => {
      const file = path.join(repoRoot, item.file);
      const fanOut = (importsByFile.get(file) || []).length;
      const fanIn = (importersByFile.get(file) || []).length;
      return {
        file: item.file,
        lines: item.lines,
        fanIn,
        fanOut,
        coupling: fanIn + fanOut,
      };
    })
    .sort((a, b) => b.coupling - a.coupling);

  const complexityTopN = 3000;
  const complexityView = complexity.slice(0, complexityTopN);

  const routeOwnership = buildRouteOwnership(relevant);
  const boundedContexts = buildBoundedContexts(relevant);
  const duplicateCandidates = buildDuplicateCandidates(relevant);

  const report = {
    generatedAt: new Date().toISOString(),
    scope: {
      roots: scanRoots,
      rootsDiscoveredAutomatically: !process.env.ROOTS,
      note: `Architecture report covers ALL source files (.ts/.tsx/.js/.jsx/.mjs/.cjs/.py/.sol) under the following root-level directories: ${scanRoots.join(', ')}. Vendor and build output directories are excluded. Override roots with the ROOTS env var (comma-separated) if needed.`,
    },
    totals,
    topFiles: {
      note: 'Top 80 files by line count. This is a VIEW, not the totals — see `totals` for the full scanned set.',
      files: topFiles,
    },
    complexity: {
      note: `Fan-in/fan-out computed across all ${fileStats.length} scanned files. This list shows the top ${complexityTopN} by coupling (fanIn + fanOut); full analysis available in-memory but truncated here for report size.`,
      totalFilesAnalyzed: complexity.length,
      files: complexityView,
    },
    routeOwnership,
    boundedContexts,
    duplicateCandidates: {
      note: 'Mechanically flagged candidates only — same normalized base name, or small edit-distance between similarly-sized file names. This does NOT determine which file is live; check fanIn in `complexity` before deleting anything.',
      count: duplicateCandidates.length,
      candidates: duplicateCandidates,
    },
    summary: buildSummary(complexity, boundedContexts, routeOwnership, totals),
  };

  const outFile = path.join(repoRoot, 'visibility/architecture-report.json');
  fs.mkdirSync(path.dirname(outFile), { recursive: true });
  fs.writeFileSync(outFile, JSON.stringify(report, null, 2));
  console.log(`Wrote ${outFile}`);
  console.log(`Scanned roots: ${scanRoots.join(', ')}`);
  console.log(`Total files: ${totals.files}, total lines: ${totals.lines}`);
  console.log(`Duplicate candidates found: ${duplicateCandidates.length}`);
}

buildReport();
