/**
 * Rule Engine
 * 
 * Enforces architectural rules from .shogun-rules.js:
 * - API isolation (certain services can't call others)
 * - Polling constraints (max frequency limits)
 * - Naming standards (file/function naming conventions)
 * - Dependency restrictions
 */

import fs from 'fs';
import path from 'path';
import { logger } from '../../utils/logger';

export interface Rule {
  id: string;
  name: string;
  type: 'isolation' | 'frequency' | 'naming' | 'dependency' | 'custom';
  enabled: boolean;
  match: string | RegExp | ((code: string, filePath: string) => boolean);
  violation: string;
  severity: 'error' | 'warning';
}

export interface RuleBreach {
  file: string;
  line?: number;
  rule: string;
  severity: 'error' | 'warning';
  message: string;
  code?: string;
}

export class RuleEngine {
  private projectRoot: string;
  private rules: Rule[] = [];

  constructor(projectRoot: string) {
    this.projectRoot = projectRoot;
    this.loadRules();
  }

  /**
   * Load rules from .shogun-rules.js
   */
  private loadRules(): void {
    const rulesPath = path.join(this.projectRoot, '.shogun-rules.js');

    if (!fs.existsSync(rulesPath)) {
      logger.warn(`No .shogun-rules.js found, using default rules`);
      this.loadDefaultRules();
      return;
    }

    try {
      // Load rules from file (can be extended by user)
      delete require.cache[rulesPath];
      const rulesModule = require(rulesPath);
      this.rules = rulesModule.rules || [];
      logger.info(`Loaded ${this.rules.length} rules from .shogun-rules.js`);
    } catch (error) {
      logger.error(`Failed to load .shogun-rules.js:`, error);
      this.loadDefaultRules();
    }
  }

  /**
   * Load default architectural rules
   */
  private loadDefaultRules(): void {
    this.rules = [
      {
        id: 'api-isolation-services',
        name: 'API Isolation: Services',
        type: 'isolation',
        enabled: true,
        match: /priceHistoryService|ohlcvService/,
        violation: 'Direct import from other services not allowed',
        severity: 'error',
      },
      {
        id: 'api-isolation-ccxt',
        name: 'API Isolation: CCXT',
        type: 'isolation',
        enabled: true,
        match:
          /from ['"].*ccxtService['"].*(?!ohlcvService|priceHistoryService)/,
        violation: 'CCXT should only be used through ohlcvService',
        severity: 'warning',
      },
      {
        id: 'polling-frequency',
        name: 'Polling Frequency Limits',
        type: 'frequency',
        enabled: true,
        match: /setInterval.*[0-9]{1,3}(?!0{3})/,
        violation: 'Polling intervals should be >= 1000ms to avoid rate limiting',
        severity: 'warning',
      },
      {
        id: 'naming-constants',
        name: 'Naming: Constants',
        type: 'naming',
        enabled: true,
        match: /(?:const\s+[a-z]\w+\s*=\s*(?:process\.env|CONFIG))/,
        violation: 'Configuration constants should be UPPER_CASE',
        severity: 'warning',
      },
      {
        id: 'naming-functions',
        name: 'Naming: Functions',
        type: 'naming',
        enabled: true,
        match: /function\s+[A-Z]/,
        violation: 'Functions should be camelCase, not PascalCase',
        severity: 'warning',
      },
      {
        id: 'no-eval',
        name: 'Security: No Eval',
        type: 'custom',
        enabled: true,
        match: /\beval\s*\(/,
        violation: 'eval() is forbidden for security reasons',
        severity: 'error',
      },
      {
        id: 'no-any-type',
        name: 'Type Safety: No any',
        type: 'custom',
        enabled: true,
        match: /:\s*any\b/,
        violation: 'Avoid "any" type - use specific types instead',
        severity: 'warning',
      },
      {
        id: 'error-handling',
        name: 'Error Handling Required',
        type: 'custom',
        enabled: false, // Disabled by default (complex to check)
        match: /\\.catch\s*\(\s*\)/,
        violation: 'Empty catch blocks are not allowed',
        severity: 'error',
      },
    ];

    logger.info(`Loaded ${this.rules.length} default rules`);
  }

  /**
   * Check file against all rules
   */
  checkFile(filePath: string): RuleBreach[] {
    const breaches: RuleBreach[] = [];

    try {
      const content = fs.readFileSync(filePath, 'utf8');
      const relPath = path.relative(this.projectRoot, filePath);

      for (const rule of this.rules) {
        if (!rule.enabled) continue;

        let violated = false;

        // Check based on rule match type
        if (typeof rule.match === 'string') {
          violated = content.includes(rule.match);
        } else if (rule.match instanceof RegExp) {
          violated = rule.match.test(content);
        } else if (typeof rule.match === 'function') {
          violated = rule.match(content, filePath);
        }

        if (violated) {
          // Find line number if possible
          let line: number | undefined;
          if (rule.match instanceof RegExp) {
            const lines = content.split('\n');
            for (let i = 0; i < lines.length; i++) {
              if (rule.match.test(lines[i])) {
                line = i + 1;
                break;
              }
            }
          }

          breaches.push({
            file: relPath,
            line,
            rule: rule.id,
            severity: rule.severity,
            message: rule.violation,
          });
        }
      }
    } catch (error) {
      logger.warn(`Failed to check rules for ${filePath}:`, error);
    }

    return breaches;
  }

  /**
   * Check entire project
   */
  async checkProject(userFiles: string[]): Promise<RuleBreach[]> {
    const breaches: RuleBreach[] = [];

    for (const file of userFiles) {
      const fileBreaches = this.checkFile(file);
      breaches.push(...fileBreaches);
    }

    return breaches;
  }

  /**
   * Get rule by ID
   */
  getRule(id: string): Rule | undefined {
    return this.rules.find((r) => r.id === id);
  }

  /**
   * Enable/disable rule
   */
  setRuleEnabled(id: string, enabled: boolean): boolean {
    const rule = this.getRule(id);
    if (rule) {
      rule.enabled = enabled;
      return true;
    }
    return false;
  }

  /**
   * List all rules
   */
  listRules(): Rule[] {
    return this.rules.map((r) => ({
      ...r,
      match: r.match instanceof RegExp ? r.match.source : String(r.match),
    }));
  }
}
