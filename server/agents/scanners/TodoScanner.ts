/**
 * TODO Scanner
 * 
 * Finds all TODO comments and extracts:
 * - File location
 * - Line number
 * - Context (surrounding code)
 * - Priority (if marked)
 * - Assigned owner (if specified)
 */

import fs from 'fs';
import path from 'path';
import { logger } from '../../utils/logger';

export interface TodoItem {
  file: string;
  line: number;
  priority: 'critical' | 'high' | 'medium' | 'low';
  owner?: string;
  text: string;
  context: {
    before: string;
    after: string;
  };
}

export class TodoScanner {
  private projectRoot: string;
  private ignorePatterns = [
    'node_modules',
    '.git',
    'dist',
    'build',
    '.next',
    'coverage',
  ];

  constructor(projectRoot: string) {
    this.projectRoot = projectRoot;
  }

  /**
   * Scan entire project for TODOs
   */
  async scan(): Promise<TodoItem[]> {
    const todos: TodoItem[] = [];

    const scanDir = (dir: string) => {
      try {
        const files = fs.readdirSync(dir);

        for (const file of files) {
          const fullPath = path.join(dir, file);
          const stat = fs.statSync(fullPath);

          if (stat.isDirectory()) {
            if (!this.ignorePatterns.some((pattern) => fullPath.includes(pattern))) {
              scanDir(fullPath);
            }
          } else if (['.ts', '.js'].some((ext) => file.endsWith(ext))) {
            const items = this.scanFile(fullPath);
            todos.push(...items);
          }
        }
      } catch (error) {
        logger.warn(`Failed to scan ${dir}:`, error);
      }
    };

    scanDir(this.projectRoot);
    return todos;
  }

  /**
   * Scan specific file for TODOs
   */
  scanFile(filePath: string): TodoItem[] {
    const todos: TodoItem[] = [];

    try {
      const content = fs.readFileSync(filePath, 'utf8');
      const lines = content.split('\n');

      // Match: // TODO: text or // TODO (critical): text or // TODO @owner: text
      const todoRegex = /\/\/\s*TODO\s*(?:\((\w+)\))?\s*(?:@(\w+))?\s*:\s*(.*)/i;

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const match = line.match(todoRegex);

        if (match) {
          const [, priorityStr, owner, text] = match;

          const priority = (priorityStr?.toLowerCase() as any) || 'medium';
          const relPath = path.relative(this.projectRoot, filePath);

          todos.push({
            file: relPath,
            line: i + 1,
            priority,
            owner,
            text: text.trim(),
            context: {
              before: lines[Math.max(0, i - 2)],
              after: lines[Math.min(lines.length - 1, i + 2)],
            },
          });
        }
      }
    } catch (error) {
      logger.warn(`Failed to scan ${filePath}:`, error);
    }

    return todos;
  }

  /**
   * Get TODOs by priority level
   */
  getByPriority(todos: TodoItem[], priority: string): TodoItem[] {
    return todos.filter((t) => t.priority === priority);
  }

  /**
   * Get TODOs assigned to owner
   */
  getByOwner(todos: TodoItem[], owner: string): TodoItem[] {
    return todos.filter((t) => t.owner === owner);
  }

  /**
   * Get unassigned TODOs
   */
  getUnassigned(todos: TodoItem[]): TodoItem[] {
    return todos.filter((t) => !t.owner);
  }
}
