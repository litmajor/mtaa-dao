import fs from 'fs/promises';
import path from 'path';

const ROOT = path.resolve(process.cwd());
const TARGETS = ['server/storage.ts', 'server/routes.ts'];

const patterns = [
  { label: 'type annotation', regex: /:\s*any\b/ },
  { label: 'type assertion', regex: /\bas\s+any\b/ },
  { label: 'generic any', regex: /<\s*any\s*>/ },
  { label: 'array any', regex: /\bany\[\]/ },
  { label: 'record any', regex: /\bRecord<[^>]*\bany\b[^>]*>/ },
];

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
  const results: Record<string, Array<{ line: number; text: string; pattern: string }>> = {};

  for (const relative of TARGETS) {
    const file = path.join(ROOT, relative);
    try {
      const text = await fs.readFile(file, 'utf8');
      const matches = findMatches(text);
      if (matches.length > 0) {
        results[relative] = matches;
      }
    } catch (error) {
      console.error(`Failed to read ${relative}:`, error);
    }
  }

  const totalFiles = Object.keys(results).length;
  const totalMatches = Object.values(results).reduce((sum, arr) => sum + arr.length, 0);

  console.log(`\nFound ${totalMatches} \`any\` usage occurrences in ${totalFiles} hotspot files.`);

  for (const [file, matches] of Object.entries(results)) {
    console.log(`\n${file} (${matches.length})`);
    for (const match of matches) {
      console.log(`  ${match.line.toString().padStart(4)} | ${match.pattern} | ${match.text}`);
    }
  }

  if (process.argv.includes('--json')) {
    const reportPath = path.join(ROOT, 'scan-any-hotspots-report.json');
    await fs.writeFile(reportPath, JSON.stringify(results, null, 2), 'utf8');
    console.log(`\nJSON report written to ${reportPath}`);
  }
}

run().catch((error) => {
  console.error('Failed to run hotspot any scanner:', error);
  process.exit(1);
});
