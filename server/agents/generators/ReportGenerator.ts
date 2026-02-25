/**
 * Report Generator
 * 
 * Formats audit results into:
 * - JSON (machine-readable)
 * - Markdown (human-readable)
 * - HTML (web viewable)
 * - CSV (spreadsheet compatible)
 */

import fs from 'fs';
import path from 'path';
import { logger } from '../../utils/logger';

export interface AuditResult {
  scanId: string;
  timestamp: string;
  projectRoot: string;
  duration: number;
  todos: any[];
  importIssues: any[];
  routeViolations: any[];
  ruleBreaches: any[];
  entropy: {
    score: number;
    severity: string;
  };
  statistics: {
    totalTodos: number;
    totalImportIssues: number;
    totalRouteViolations: number;
    totalRuleBreaches: number;
    errorBreaches: number;
    warningBreaches: number;
  };
  recommendations: string[];
}

export class ReportGenerator {
  private projectRoot: string;
  private outputDir: string;

  constructor(projectRoot: string) {
    this.projectRoot = projectRoot;
    this.outputDir = path.join(projectRoot, 'reports', 'agent-audits');
    this.ensureOutputDir();
  }

  private ensureOutputDir(): void {
    if (!fs.existsSync(this.outputDir)) {
      fs.mkdirSync(this.outputDir, { recursive: true });
    }
  }

  /**
   * Generate all report formats
   */
  async generateAll(result: AuditResult): Promise<string> {
    const timestamp = result.scanId;

    await Promise.all([
      this.generateJSON(result, timestamp),
      this.generateMarkdown(result, timestamp),
      this.generateHTML(result, timestamp),
      this.generateCSV(result, timestamp),
    ]);

    logger.info(`Generated audit reports in ${this.outputDir}`);
    return timestamp;
  }

  /**
   * Generate JSON report
   */
  private async generateJSON(result: AuditResult, timestamp: string): Promise<void> {
    const filePath = path.join(this.outputDir, `audit-${timestamp}.json`);
    const json = JSON.stringify(result, null, 2);
    await fs.promises.writeFile(filePath, json);
    logger.info(`JSON report: ${filePath}`);
  }

  /**
   * Generate Markdown report
   */
  private async generateMarkdown(result: AuditResult, timestamp: string): Promise<void> {
    let md = `# Code Audit Report

**Scan ID:** ${result.scanId}  
**Timestamp:** ${result.timestamp}  
**Duration:** ${result.duration}ms  
**Project:** ${result.projectRoot}  

---

## Executive Summary

| Metric | Value |
|--------|-------|
| **Entropy Score** | ${result.entropy.score}/100 (${result.entropy.severity.toUpperCase()}) |
| **Total TODOs** | ${result.statistics.totalTodos} |
| **Import Issues** | ${result.statistics.totalImportIssues} |
| **Route Violations** | ${result.statistics.totalRouteViolations} |
| **Rule Breaches** | ${result.statistics.totalRuleBreaches} (${result.statistics.errorBreaches} errors, ${result.statistics.warningBreaches} warnings) |

---

## TODO Items (${result.statistics.totalTodos})

`;

    if (result.todos.length === 0) {
      md += `✅ No TODOs found.\n\n`;
    } else {
      md += `| Priority | File | Line | Owner | Task |\n`;
      md += `|----------|------|------|-------|------|\n`;

      for (const todo of result.todos) {
        const owner = todo.owner || '—';
        const emoji = {
          critical: '🔴',
          high: '🟠',
          medium: '🟡',
          low: '🟢',
        }[todo.priority] || '◾';

        md += `| ${emoji} ${todo.priority} | ${todo.file} | ${todo.line} | ${owner} | ${todo.text} |\n`;
      }
    }

    md += `\n---\n\n## Import Issues (${result.statistics.totalImportIssues})\n\n`;

    if (result.importIssues.length === 0) {
      md += `✅ All imports valid.\n\n`;
    } else {
      for (const issue of result.importIssues) {
        md += `### ${issue.type.toUpperCase()}\n`;
        md += `- **File:** ${issue.file}:${issue.line}\n`;
        md += `- **Statement:** \`${issue.importStatement}\`\n`;
        if (issue.targetFile) md += `- **Target:** ${issue.targetFile}\n`;
        md += '\n';
      }
    }

    md += `---\n\n## Route Violations (${result.statistics.totalRouteViolations})\n\n`;

    if (result.routeViolations.length === 0) {
      md += `✅ No route violations.\n\n`;
    } else {
      for (const violation of result.routeViolations) {
        md += `### ${violation.type.toUpperCase()} - ${violation.method} ${violation.path}\n`;
        md += `- **Details:** ${violation.details}\n`;
        md += `- **Locations:**\n`;
        for (const loc of violation.locations) {
          md += `  - ${loc}\n`;
        }
        md += '\n';
      }
    }

    md += `---\n\n## Rule Breaches (${result.statistics.totalRuleBreaches})\n\n`;

    if (result.ruleBreaches.length === 0) {
      md += `✅ All architectural rules respected.\n\n`;
    } else {
      const errors = result.ruleBreaches.filter((b) => b.severity === 'error');
      const warnings = result.ruleBreaches.filter((b) => b.severity === 'warning');

      if (errors.length > 0) {
        md += `### 🔴 Errors (${errors.length})\n\n`;
        for (const breach of errors) {
          md += `- **${breach.rule}:** ${breach.message}\n`;
          md += `  - File: ${breach.file}`;
          if (breach.line) md += `:${breach.line}`;
          md += '\n';
        }
        md += '\n';
      }

      if (warnings.length > 0) {
        md += `### 🟡 Warnings (${warnings.length})\n\n`;
        for (const breach of warnings) {
          md += `- **${breach.rule}:** ${breach.message}\n`;
          md += `  - File: ${breach.file}`;
          if (breach.line) md += `:${breach.line}`;
          md += '\n';
        }
        md += '\n';
      }
    }

    md += `---\n\n## Recommendations\n\n`;

    if (result.recommendations.length === 0) {
      md += `✅ No immediate action required.\n`;
    } else {
      for (const rec of result.recommendations) {
        md += `- ${rec}\n`;
      }
    }

    md += `\n---\n_Generated by Background Refactor Agent_\n`;

    const filePath = path.join(this.outputDir, `audit-${timestamp}.md`);
    await fs.promises.writeFile(filePath, md);
    logger.info(`Markdown report: ${filePath}`);
  }

  /**
   * Generate HTML report
   */
  private async generateHTML(result: AuditResult, timestamp: string): Promise<void> {
    const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Code Audit Report</title>
  <style>
    * { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; }
    body { padding: 20px; background: #f5f5f5; color: #333; }
    .container { max-width: 1000px; margin: 0 auto; background: white; padding: 30px; border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.1); }
    h1 { color: #1a1a1a; border-bottom: 3px solid #007acc; padding-bottom: 10px; }
    h2 { color: #007acc; margin-top: 30px; }
    .summary { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 15px; margin: 20px 0; }
    .metric { padding: 15px; background: #f9f9f9; border-left: 4px solid #007acc; border-radius: 4px; }
    .metric-value { font-size: 24px; font-weight: bold; color: #007acc; }
    .metric-label { font-size: 12px; color: #666; margin-top: 5px; }
    table { width: 100%; border-collapse: collapse; margin: 15px 0; }
    th, td { padding: 10px; text-align: left; border-bottom: 1px solid #ddd; }
    th { background: #f0f0f0; font-weight: 600; }
    tr:hover { background: #f9f9f9; }
    .error { color: #d32f2f; }
    .warning { color: #f57c00; }
    .success { color: #388e3c; }
    .metric.critical { border-left-color: #d32f2f; }
    .metric.warning { border-left-color: #f57c00; }
    .metric.info { border-left-color: #1976d2; }
    .entropy { text-align: center; font-size: 48px; font-weight: bold; padding: 20px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; border-radius: 8px; margin: 20px 0; }
  </style>
</head>
<body>
  <div class="container">
    <h1>📊 Code Audit Report</h1>
    
    <div style="color: #666; margin: 10px 0;">
      <strong>Scan ID:</strong> ${result.scanId}<br>
      <strong>Timestamp:</strong> ${result.timestamp}<br>
      <strong>Duration:</strong> ${result.duration}ms
    </div>

    <div class="entropy">
      ${result.entropy.score}/100<br>
      <span style="font-size: 24px;">${result.entropy.severity.toUpperCase()}</span>
    </div>

    <div class="summary">
      <div class="metric ${result.statistics.totalTodos > 5 ? 'warning' : 'info'}">
        <div class="metric-value">${result.statistics.totalTodos}</div>
        <div class="metric-label">TODO Items</div>
      </div>
      <div class="metric ${result.statistics.totalImportIssues > 0 ? 'error' : 'success'}">
        <div class="metric-value">${result.statistics.totalImportIssues}</div>
        <div class="metric-label">Import Issues</div>
      </div>
      <div class="metric ${result.statistics.totalRouteViolations > 0 ? 'warning' : 'success'}">
        <div class="metric-value">${result.statistics.totalRouteViolations}</div>
        <div class="metric-label">Route Violations</div>
      </div>
      <div class="metric ${result.statistics.errorBreaches > 0 ? 'critical' : result.statistics.warningBreaches > 0 ? 'warning' : 'success'}">
        <div class="metric-value">${result.statistics.totalRuleBreaches}</div>
        <div class="metric-label">Rule Breaches</div>
      </div>
    </div>

    <h2>Recommendations</h2>
    ${result.recommendations.length > 0 ? `<ul>${result.recommendations.map((r) => `<li>${r}</li>`).join('')}</ul>` : '<p class="success">✅ No immediate action required.</p>'}
  </div>
</body>
</html>`;

    const filePath = path.join(this.outputDir, `audit-${timestamp}.html`);
    await fs.promises.writeFile(filePath, html);
    logger.info(`HTML report: ${filePath}`);
  }

  /**
   * Generate CSV report (for spreadsheets)
   */
  private async generateCSV(result: AuditResult, timestamp: string): Promise<void> {
    let csv = 'Type,File,Line,Severity,Issue,Details\n';

    // Add TODOs
    for (const todo of result.todos) {
      csv += `TODO,"${todo.file}",${todo.line},${todo.priority},"${todo.text}","Priority: ${todo.priority}${todo.owner ? ', Owner: ' + todo.owner : ''}"\n`;
    }

    // Add import issues
    for (const issue of result.importIssues) {
      csv += `Import,"${issue.file}",${issue.line},error,"${issue.type}","${issue.importStatement}"\n`;
    }

    // Add route violations
    for (const violation of result.routeViolations) {
      csv += `Route,"${violation.file}",,${violation.severity},"${violation.type}","${violation.method} ${violation.path}: ${violation.details}"\n`;
    }

    // Add rule breaches
    for (const breach of result.ruleBreaches) {
      csv += `Rule,"${breach.file}",${breach.line || ''},"${breach.severity}","${breach.rule}","${breach.message}"\n`;
    }

    const filePath = path.join(this.outputDir, `audit-${timestamp}.csv`);
    await fs.promises.writeFile(filePath, csv);
    logger.info(`CSV report: ${filePath}`);
  }
}
