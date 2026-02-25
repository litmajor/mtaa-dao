/**
 * Diff Proposer
 * 
 * Generates patches for fixable issues:
 * - Removes unused imports
 * - Fixes naming violations
 * - Reorders imports
 * - Never auto-commits
 */

import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { logger } from '../../utils/logger';

export interface Patch {
  id: string;
  file: string;
  type: 'remove-import' | 'add-import' | 'rename' | 'fix-format' | 'custom';
  description: string;
  originalCode: string;
  fixedCode: string;
  riskLevel: 'low' | 'medium' | 'high';
  revertCommand: string;
}

export class DiffProposer {
  private projectRoot: string;
  private patchDir: string;

  constructor(projectRoot: string) {
    this.projectRoot = projectRoot;
    this.patchDir = path.join(projectRoot, 'patches');
    this.ensurePatchDir();
  }

  private ensurePatchDir(): void {
    if (!fs.existsSync(this.patchDir)) {
      fs.mkdirSync(this.patchDir, { recursive: true });
    }
  }

  /**
   * Propose fixing unused imports
   */
  proposeUnusedImportRemoval(file: string, imports: string[]): Patch[] {
    const patches: Patch[] = [];

    try {
      const content = fs.readFileSync(file, 'utf8');
      const lines = content.split('\n');

      for (const imp of imports) {
        // Find the import line
        const importRegex = new RegExp(
          `import\\s+.*from\\s+['"](${imp})['"];?`,
          'i'
        );

        for (let i = 0; i < lines.length; i++) {
          if (importRegex.test(lines[i])) {
            const originalLine = lines[i];
            const newLines = lines.filter((_, idx) => idx !== i);
            const originalCode = lines.slice(Math.max(0, i - 2), i + 3).join('\n');
            const fixedCode = newLines
              .slice(Math.max(0, i - 2), i + 2)
              .join('\n');

            patches.push({
              id: `remove-import-${path.basename(file)}-${i}`,
              file: path.relative(this.projectRoot, file),
              type: 'remove-import',
              description: `Remove unused import: ${imp}`,
              originalCode,
              fixedCode,
              riskLevel: 'low',
              revertCommand: `git show HEAD:${file} | sed -n '${i + 1}p'`,
            });

            break;
          }
        }
      }
    } catch (error) {
      logger.warn(`Failed to propose fixes for ${file}:`, error);
    }

    return patches;
  }

  /**
   * Propose fixing naming violations
   */
  proposeNamingFix(file: string, violations: any[]): Patch[] {
    const patches: Patch[] = [];

    try {
      const content = fs.readFileSync(file, 'utf8');
      const lines = content.split('\n');

      for (const violation of violations) {
        // Example: function MyFunc -> function myFunc
        if (violation.type === 'function-naming' && violation.line) {
          const lineIdx = violation.line - 1;
          const originalLine = lines[lineIdx];

          const fixedLine = originalLine.replace(
            /function\s+([A-Z]\w*)/,
            (match, name) => {
              const camelCase = name[0].toLowerCase() + name.slice(1);
              return match.replace(name, camelCase);
            }
          );

          if (fixedLine !== originalLine) {
            patches.push({
              id: `rename-function-${path.basename(file)}-${violation.line}`,
              file: path.relative(this.projectRoot, file),
              type: 'rename',
              description: `Rename function to camelCase: ${violation.detail}`,
              originalCode: originalLine,
              fixedCode: fixedLine,
              riskLevel: 'high', // Requires updating all callers
              revertCommand: `git diff HEAD -- ${file}`,
            });
          }
        }

        // Example: const myVar = process.env -> const MY_VAR = process.env
        if (violation.type === 'constant-naming' && violation.line) {
          const lineIdx = violation.line - 1;
          const originalLine = lines[lineIdx];

          const fixedLine = originalLine.replace(
            /(const\s+)([a-z]\w*)\s*=/,
            (match, prefix, name) => {
              const upperCase = name.toUpperCase();
              return match.replace(name, upperCase);
            }
          );

          if (fixedLine !== originalLine) {
            patches.push({
              id: `rename-const-${path.basename(file)}-${violation.line}`,
              file: path.relative(this.projectRoot, file),
              type: 'rename',
              description: `Rename constant to UPPER_CASE: ${violation.detail}`,
              originalCode: originalLine,
              fixedCode: fixedLine,
              riskLevel: 'high',
              revertCommand: `git diff HEAD -- ${file}`,
            });
          }
        }
      }
    } catch (error) {
      logger.warn(`Failed to propose naming fixes for ${file}:`, error);
    }

    return patches;
  }

  /**
   * Propose removing any-type annotations
   */
  proposeRemoveAnyType(file: string): Patch[] {
    const patches: Patch[] = [];

    try {
      const content = fs.readFileSync(file, 'utf8');
      const lines = content.split('\n');

      const anyRegex = /:\s*any\b/g;

      for (let i = 0; i < lines.length; i++) {
        if (anyRegex.test(lines[i])) {
          const originalLine = lines[i];
          // This is context-dependent, so we suggest but mark as high risk
          patches.push({
            id: `remove-any-${path.basename(file)}-${i}`,
            file: path.relative(this.projectRoot, file),
            type: 'fix-format',
            description: `Replace 'any' type with specific type on line ${i + 1}`,
            originalCode: originalLine,
            fixedCode: '/* MANUAL FIX REQUIRED: Replace any with specific type */',
            riskLevel: 'high',
            revertCommand: `git checkout -- ${file}`,
          });
        }
      }
    } catch (error) {
      logger.warn(`Failed to propose any-type fixes for ${file}:`, error);
    }

    return patches;
  }

  /**
   * Generate unified diff format for patch
   */
  generateUnifiedDiff(patch: Patch): string {
    return `--- a/${patch.file}
+++ b/${patch.file}
@@ Proposed Changes @@
-${patch.originalCode}
+${patch.fixedCode}

Risk Level: ${patch.riskLevel}
Description: ${patch.description}

IMPORTANT: This patch was generated by the Background Refactor Agent.
Please review carefully before applying. Never auto-commit.

Revert: ${patch.revertCommand}
`;
  }

  /**
   * Save patches to files
   */
  async savePatches(patches: Patch[], scanId: string): Promise<string[]> {
    const savedFiles: string[] = [];

    for (let i = 0; i < patches.length; i++) {
      const patch = patches[i];
      const fileName = `${scanId}-${i + 1}-${patch.id}.diff`;
      const filePath = path.join(this.patchDir, fileName);

      const diffContent = this.generateUnifiedDiff(patch);

      try {
        await fs.promises.writeFile(filePath, diffContent);
        savedFiles.push(filePath);
        logger.info(`Saved patch: ${filePath}`);
      } catch (error) {
        logger.error(`Failed to save patch ${fileName}:`, error);
      }
    }

    return savedFiles;
  }

  /**
   * List available patches
   */
  listPatches(): Patch[] {
    const patches: Patch[] = [];

    try {
      const files = fs.readdirSync(this.patchDir);

      for (const file of files) {
        if (file.endsWith('.diff')) {
          const content = fs.readFileSync(path.join(this.patchDir, file), 'utf8');

          // Parse patch header
          const descMatch = content.match(/Description: (.*)/);
          const description = descMatch ? descMatch[1] : 'Unknown';

          const riskMatch = content.match(/Risk Level: (low|medium|high)/);
          const riskLevel = (riskMatch ? riskMatch[1] : 'medium') as any;

          patches.push({
            id: file.replace('.diff', ''),
            file,
            type: 'custom',
            description,
            originalCode: '',
            fixedCode: '',
            riskLevel,
            revertCommand: '',
          });
        }
      }
    } catch (error) {
      logger.warn(`Failed to list patches:`, error);
    }

    return patches;
  }

  /**
   * Apply a patch (with confirmation)
   */
  async applyPatch(
    patchId: string,
    onConfirm?: (patch: Patch) => Promise<boolean>
  ): Promise<boolean> {
    const filePath = path.join(this.patchDir, `${patchId}.diff`);

    if (!fs.existsSync(filePath)) {
      logger.error(`Patch not found: ${patchId}`);
      return false;
    }

    try {
      // In production, would require human confirmation
      if (onConfirm) {
        const shouldApply = await onConfirm({} as Patch);
        if (!shouldApply) return false;
      }

      // Use git apply for safety
      execSync(`git apply "${filePath}"`, { cwd: this.projectRoot });
      logger.info(`Applied patch: ${patchId}`);
      return true;
    } catch (error) {
      logger.error(`Failed to apply patch ${patchId}:`, error);
      return false;
    }
  }

  /**
   * Discard a patch
   */
  discardPatch(patchId: string): boolean {
    const filePath = path.join(this.patchDir, `${patchId}.diff`);

    if (!fs.existsSync(filePath)) {
      return false;
    }

    try {
      fs.unlinkSync(filePath);
      logger.info(`Discarded patch: ${patchId}`);
      return true;
    } catch (error) {
      logger.error(`Failed to discard patch ${patchId}:`, error);
      return false;
    }
  }
}
