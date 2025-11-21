
import { promises as fs } from 'fs';
import path from 'path';

interface Issue {
  file: string;
  line: number;
  type: 'mock' | 'todo' | 'placeholder' | 'demo';
  content: string;
}

const PATTERNS = {
  mock: /\b(mock|MOCK|Mock)\b/,
  todo: /\b(TODO|FIXME|XXX|HACK)\b/,
  placeholder: /\b(placeholder|PLACEHOLDER|demo|DEMO)\b/,
  randomHash: /0x\$\{Math\.random/,
  hardcoded: /localhost|127\.0\.0\.1/
};

async function scanFile(filePath: string): Promise<Issue[]> {
  const issues: Issue[] = [];
  const content = await fs.readFile(filePath, 'utf-8');
  const lines = content.split('\n');

  lines.forEach((line, index) => {
    if (PATTERNS.mock.test(line) && !line.includes('// Production:')) {
      issues.push({
        file: filePath,
        line: index + 1,
        type: 'mock',
        content: line.trim()
      });
    }
    if (PATTERNS.todo.test(line)) {
      issues.push({
        file: filePath,
        line: index + 1,
        type: 'todo',
        content: line.trim()
      });
    }
    if (PATTERNS.placeholder.test(line) && !line.includes('placeholder text')) {
      issues.push({
        file: filePath,
        line: index + 1,
        type: 'placeholder',
        content: line.trim()
      });
    }
    if (PATTERNS.randomHash.test(line)) {
      issues.push({
        file: filePath,
        line: index + 1,
        type: 'demo',
        content: line.trim()
      });
    }
  });

  return issues;
}

async function scanDirectory(dir: string, issues: Issue[] = []): Promise<Issue[]> {
  const entries = await fs.readdir(dir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    
    // Skip node_modules, .git, etc.
    if (entry.name === 'node_modules' || entry.name === '.git' || entry.name === 'dist') {
      continue;
    }

    if (entry.isDirectory()) {
      await scanDirectory(fullPath, issues);
    } else if (entry.isFile() && (entry.name.endsWith('.ts') || entry.name.endsWith('.tsx'))) {
      const fileIssues = await scanFile(fullPath);
      issues.push(...fileIssues);
    }
  }

  return issues;
}

async function main() {
  console.log('🔍 Scanning for production readiness issues...\n');
  
  const issues = await scanDirectory('.');
  
  const grouped = issues.reduce((acc, issue) => {
    if (!acc[issue.type]) acc[issue.type] = [];
    acc[issue.type].push(issue);
    return acc;
  }, {} as Record<string, Issue[]>);

  console.log('📊 Summary:');
  console.log(`  Mock data: ${grouped.mock?.length || 0}`);
  console.log(`  TODOs: ${grouped.todo?.length || 0}`);
  console.log(`  Placeholders: ${grouped.placeholder?.length || 0}`);
  console.log(`  Demo code: ${grouped.demo?.length || 0}`);
  console.log(`  Total: ${issues.length}\n`);

  if (issues.length > 0) {
    console.log('📝 Details:\n');
    Object.entries(grouped).forEach(([type, typeIssues]) => {
      console.log(`\n${type.toUpperCase()}:`);
      typeIssues.forEach(issue => {
        console.log(`  ${issue.file}:${issue.line}`);
        console.log(`    ${issue.content}\n`);
      });
    });
  } else {
    console.log('✅ No issues found! Production ready.');
  }
}

main().catch(console.error);
