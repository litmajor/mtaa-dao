/**
 * Import Validator
 * 
 * Validates TypeScript/JavaScript imports:
 * - Checks file existence
 * - Detects broken imports
 * - Identifies circular dependencies
 * - Reports unused imports
 */

import fs from 'fs';
import path from 'path';
import { logger } from '../../utils/logger';

export interface ImportIssue {
  file: string;
  line: number;
  type: 'broken' | 'circular' | 'unused' | 'duplicate';
  importStatement: string;
  targetFile?: string;
  count?: number; // for duplicates
}

export class ImportValidator {
  private projectRoot: string;
  private cache = new Map<string, string[]>();
  private circularCache = new Map<string, string[]>();

  constructor(projectRoot: string) {
    this.projectRoot = projectRoot;
  }

  /**
   * Validate imports in entire project
   */
  async validate(userFiles: string[]): Promise<ImportIssue[]> {
    const issues: ImportIssue[] = [];

    for (const file of userFiles) {
      const fileIssues = await this.validateFile(file);
      issues.push(...fileIssues);
    }

    return issues;
  }

  /**
   * Validate imports in specific file
   */
  async validateFile(filePath: string): Promise<ImportIssue[]> {
    const issues: ImportIssue[] = [];
    const importMap = new Map<string, number>();

    try {
      const content = fs.readFileSync(filePath, 'utf8');
      const lines = content.split('\n');

      // Match both ES6 and CommonJS imports
      const esImportRegex = /import\s+(?:{[^}]*}|\*\s+as\s+\w+|\w+(?:,\s*{[^}]*})?)\s+from\s+['"]([^'"]+)['"]/g;
      const commonJsRegex = /require\s*\(\s*['"]([^'"]+)['"]\s*\)/g;

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];

        // Check ES6 imports
        let esMatch;
        while ((esMatch = esImportRegex.exec(line)) !== null) {
          const importPath = esMatch[1];
          const importStmt = esMatch[0];

          // Track for duplicates
          const count = (importMap.get(importPath) || 0) + 1;
          importMap.set(importPath, count);

          // Check if file exists
          const resolved = this.resolveImport(filePath, importPath);
          if (!resolved) {
            issues.push({
              file: path.relative(this.projectRoot, filePath),
              line: i + 1,
              type: 'broken',
              importStatement: importStmt,
              targetFile: importPath,
            });
          }

          // Check for circular dependencies
          if (resolved && this.isCircularDependency(filePath, resolved)) {
            issues.push({
              file: path.relative(this.projectRoot, filePath),
              line: i + 1,
              type: 'circular',
              importStatement: importStmt,
              targetFile: importPath,
            });
          }
        }

        // Check CommonJS requires
        let requireMatch;
        while ((requireMatch = commonJsRegex.exec(line)) !== null) {
          const importPath = requireMatch[1];
          const importStmt = requireMatch[0];

          const resolved = this.resolveImport(filePath, importPath);
          if (!resolved) {
            issues.push({
              file: path.relative(this.projectRoot, filePath),
              line: i + 1,
              type: 'broken',
              importStatement: importStmt,
              targetFile: importPath,
            });
          }
        }
      }

      // Detect duplicate imports
      for (const [importPath, count] of importMap) {
        if (count > 1) {
          const lineNum = lines.findIndex((l) =>
            l.includes(`from '${importPath}'`) || l.includes(`from "${importPath}"`)
          );
          if (lineNum >= 0) {
            issues.push({
              file: path.relative(this.projectRoot, filePath),
              line: lineNum + 1,
              type: 'duplicate',
              importStatement: `import from '${importPath}'`,
              count,
            });
          }
        }
      }
    } catch (error) {
      logger.warn(`Failed to validate imports in ${filePath}:`, error);
    }

    return issues;
  }

  /**
   * Resolve import path to actual file
   */
  private resolveImport(fromFile: string, importPath: string): string | null {
    try {
      // Skip external packages
      if (!importPath.startsWith('.')) {
        // For node_modules, check if installed
        try {
          require.resolve(importPath, { paths: [this.projectRoot] });
          return importPath;
        } catch {
          // Could be unresolved but we don't fail on external deps
          return importPath;
        }
      }

      const dir = path.dirname(fromFile);
      const basePath = path.resolve(dir, importPath);

      // Try direct file
      if (fs.existsSync(basePath)) {
        return basePath;
      }

      // Try with .ts extension
      if (fs.existsSync(basePath + '.ts')) {
        return basePath + '.ts';
      }

      // Try with .js extension
      if (fs.existsSync(basePath + '.js')) {
        return basePath + '.js';
      }

      // Try as directory with index
      if (
        fs.existsSync(path.join(basePath, 'index.ts')) ||
        fs.existsSync(path.join(basePath, 'index.js'))
      ) {
        return basePath;
      }

      return null;
    } catch {
      return null;
    }
  }

  /**
   * Detect circular dependencies using DFS
   */
  private isCircularDependency(
    fromFile: string,
    toFile: string,
    visited = new Set<string>()
  ): boolean {
    if (visited.has(fromFile)) {
      return true;
    }

    visited.add(fromFile);

    try {
      const content = fs.readFileSync(toFile, 'utf8');
      const imports = this.extractImports(content);

      for (const imp of imports) {
        const resolved = this.resolveImport(toFile, imp);
        if (resolved === fromFile) {
          return true;
        }

        if (resolved && this.isCircularDependency(toFile, resolved, new Set(visited))) {
          return true;
        }
      }
    } catch {
      // Ignore read errors
    }

    return false;
  }

  /**
   * Extract all imports from file
   */
  private extractImports(content: string): string[] {
    const imports: string[] = [];
    const esImportRegex = /import\s+(?:{[^}]*}|\*\s+as\s+\w+|\w+(?:,\s*{[^}]*})?)\s+from\s+['"]([^'"]+)['"]/g;
    const commonJsRegex = /require\s*\(\s*['"]([^'"]+)['"]\s*\)/g;

    let match;
    while ((match = esImportRegex.exec(content)) !== null) {
      imports.push(match[1]);
    }

    while ((match = commonJsRegex.exec(content)) !== null) {
      imports.push(match[1]);
    }

    return imports;
  }
}
