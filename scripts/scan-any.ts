import fs from 'fs/promises';
import path from 'path';

const ROOT = path.resolve(process.cwd());
const IGNORE_DIRS = new Set(['node_modules', '.git', 'dist', 'build', 'out', 'coverage', '.cache']);
const EXTENSIONS = new Set(['.ts', '.tsx', '.js', '.jsx']);

const patterns = [
  { label: 'type annotation', regex: /:\s*any\b/ },
  { label: 'type assertion', regex: /\bas\s+any\b/ },
  { label: 'generic any', regex: /<\s*any\s*>/ },
  { label: 'array any', regex: /\bany\[\]/ },
  { label: 'record any', regex: /\bRecord<[^>]*\bany\b[^>]*>/ },
];

async function walk(dir: string): Promise<string[]> {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  const paths: string[] = [];

  for (const entry of entries) {
    if (IGNORE_DIRS.has(entry.name)) continue;
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      paths.push(...await walk(fullPath));
    } else if (entry.isFile() && EXTENSIONS.has(path.extname(entry.name))) {
      paths.push(fullPath);
    }
  }

  return paths;
}

function findMatches(text: string) {
  const lines = text.split(/\r?\n/);
  const matches: Array<{ line: number; text: string; pattern: string }> = [];

  for (let idx = 0; idx < lines.length; idx++) {
    const line = lines[idx];
    for (const pattern of patterns) {
      if (pattern.regex.test(line)) {
        matches.push({ line: idx + 1, text: line.trim(), pattern: pattern.label });
      }
    }
  }

  return matches;
}

async function run() {
  const files = await walk(ROOT);
  const results: Record<string, Array<{ line: number; text: string; pattern: string }>> = {};

  for (const file of files) {
    const text = await fs.readFile(file, 'utf8');
    const matches = findMatches(text);
    if (matches.length > 0) {
      const relative = path.relative(ROOT, file);
      results[relative] = matches;
    }
  }

  const totalFiles = Object.keys(results).length;
  const totalMatches = Object.values(results).reduce((sum, arr) => sum + arr.length, 0);

  console.log(`\nFound ${totalMatches} \`any\` usage occurrences in ${totalFiles} files.`);
  console.log('Use `npm run scan:any -- --json` to write a JSON report.');

  for (const [file, matches] of Object.entries(results).sort(([a], [b]) => a.localeCompare(b))) {
    console.log(`\n${file} (${matches.length})`);
    for (const match of matches) {
      console.log(`  ${match.line.toString().padStart(4)} | ${match.pattern} | ${match.text}`);
    }
  }

  if (process.argv.includes('--json')) {
    const reportPath = path.join(ROOT, 'scan-any-report.json');
    await fs.writeFile(reportPath, JSON.stringify(results, null, 2), 'utf8');
    console.log(`\nJSON report written to ${reportPath}`);
  }
}

run().catch((error) => {
  console.error('Failed to run any scanner:', error);
  process.exit(1);
});
