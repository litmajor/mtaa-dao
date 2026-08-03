import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '..', '..');

describe('architecture report generator', () => {
  it('produces dependency, route ownership, and bounded context metadata', () => {
    execFileSync(process.execPath, ['scripts/architecture-report.mjs'], {
      cwd: repoRoot,
      stdio: 'pipe',
    });

    const reportPath = path.join(repoRoot, 'visibility/architecture-report.json');
    const report = JSON.parse(fs.readFileSync(reportPath, 'utf8'));
    const hasFanIn = report.complexity.some((item) => item.fanIn > 0);

    expect(report.scope).toBeDefined();
    expect(report.summary).toBeDefined();
    expect(report.summary.biggestHotspots.length).toBeGreaterThan(0);
    expect(report.summary.contextClusters.length).toBeGreaterThan(0);
    expect(hasFanIn).toBe(true);
    expect(report.routeOwnership.some((item) => item.routeCount > 0)).toBe(true);
    expect(report.boundedContexts.some((item) => item.files.length > 0)).toBe(true);
  });
});
