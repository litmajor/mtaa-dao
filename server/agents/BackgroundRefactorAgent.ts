/**
 * 🤖 Background Refactor Agent
 * 
 * Autonomous system for code quality enforcement:
 * - Scans for TODOs and generates implementation proposals
 * - Validates import consistency
 * - Audits Express routes for duplication/violations
 * - Enforces architectural rules ("Shogun discipline")
 * - Generates diffs (never auto-commits)
 * 
 * Philosophy:
 * ✅ Agent proposes → Human reviews → Human approves
 * ❌ Never blind modification
 * ❌ Never auto-commit without explicit approval
 * 
 * Runs as background job, scheduled or on-demand
 */

import { v4 as uuidv4 } from 'uuid';
import path from 'path';
import fs from 'fs';
import { logger } from '../utils/logger';
import { TodoScanner } from './scanners/TodoScanner';
import { ImportValidator } from './scanners/ImportValidator';
import { RouteAuditor } from './scanners/RouteAuditor';
import { RuleEngine } from './engines/RuleEngine';
import { IntelligentReportGenerator } from './generators/route-intelligence-enricher';
import { DiffProposer } from './proposers/DiffProposer';
import { externalAPITracker } from '../services/externalAPITracker';

export interface AuditResult {
  scanId: string;
  timestamp: string;
  projectRoot: string;
  duration: number;
  todos: TodoItem[];
  importIssues: ImportIssue[];
  routeViolations: RouteViolation[];
  ruleBreaches: RuleBreach[];
  entropy: {
    score: number;
    severity: 'critical' | 'high' | 'medium' | 'low';
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
  patches?: string[];
}

export interface TodoItem {
  file: string;
  line: number;
  text: string;
}

export interface ImportIssue {
  file: string;
  importStatement: string;
  type: 'unused' | 'missing' | 'invalid' | string;
  message?: string;
}

export interface RouteViolation {
  path: string;
  method?: string;
  middlewareCount?: number;
  domain?: string;
  fullDomain?: string;
  severity?: 'error' | 'warning' | 'info';
}

export interface RuleBreach {
  file: string;
  rule?: string;
  message: string;
  severity?: 'error' | 'warning' | 'info';
}

export interface AgentConfig {
  routesDir?: string;
  runDir?: string;
}

export class AuditError extends Error {
  scanId?: string;
  constructor(message: string, opts?: { cause?: unknown; scanId?: string }) {
    super(message);
    if (opts?.cause) (this as any).cause = opts.cause;
    this.name = 'AuditError';
    this.scanId = opts?.scanId;
  }
}

export class BackgroundRefactorAgent {
  private projectRoot: string;
  private todoScanner: TodoScanner;
  private importValidator: ImportValidator;
  private routeAuditor: RouteAuditor;
  private ruleEngine: RuleEngine;
  private reportGenerator: IntelligentReportGenerator;
  private diffProposer: DiffProposer;
  private userFiles: string[] = [];
  private config: AgentConfig;

  constructor(projectRoot: string, config: Partial<AgentConfig> = {}) {
    this.projectRoot = projectRoot;
    this.config = {
      routesDir: path.join('server', 'routes'),
      ...config
    };

    // Initialize all sub-agents
    this.todoScanner = new TodoScanner(projectRoot);
    this.importValidator = new ImportValidator(projectRoot);
    this.routeAuditor = new RouteAuditor(projectRoot);
    this.ruleEngine = new RuleEngine(projectRoot);
    this.reportGenerator = new IntelligentReportGenerator(projectRoot);
    this.diffProposer = new DiffProposer(projectRoot);

    logger.info(`🤖 BackgroundRefactorAgent initialized`);
  }

  /**
   * Set user files to audit (optional, for scoped scans)
   */
  setUserFiles(files: string[]): void {
    this.userFiles = files;
  }

  /**
   * Run full audit (comprehensive code quality check)
   */
  async runFullAudit(): Promise<AuditResult> {
    logger.info('🔍 Starting full architecture audit...');
    const scanId = `scan-${Date.now()}-${uuidv4().slice(0, 8)}`;
    const timestamp = new Date().toISOString();
    const startTime = Date.now();

    try {
      // Phase 1: TODO Scanning
      logger.info('📝 Phase 1: Scanning TODOs...');
      const todos = await this.runWithTimeout(this.todoScanner.scan(), 60_000, 'todoScanner.scan');
      logger.info(`  ✓ Found ${todos.length} TODO items`);

      // Phase 2: Import Validation
      logger.info('📦 Phase 2: Validating imports...');
      const importIssues = await this.runWithTimeout(
        this.importValidator.validate(this.userFiles),
        60_000,
        'importValidator.validate'
      );
      logger.info(`  ✓ Found ${importIssues.length} import issues`);

      // Phase 3: Route Auditing
      logger.info('🛣️  Phase 3: Auditing routes...');
      const routesDir = path.join(this.projectRoot, this.config.routesDir || 'server/routes');
      const routeViolations = await this.runWithTimeout(
        this.routeAuditor.audit(routesDir),
        60_000,
        'routeAuditor.audit'
      );
      logger.info(`  ✓ Found ${routeViolations.length} route violations`);

      // Phase 4: Rule Enforcement
      logger.info('⚖️  Phase 4: Enforcing rules...');
      const ruleBreaches = await this.runWithTimeout(
        this.ruleEngine.checkProject(this.userFiles),
        60_000,
        'ruleEngine.checkProject'
      );
      logger.info(`  ✓ Found ${ruleBreaches.length} rule breaches`);

      // Calculate entropy score
      const entropy = this.calculateEntropy({
        todos,
        importIssues,
        routeViolations,
        ruleBreaches,
      });

      // Generate patches for fixable issues
      logger.info('🔧 Phase 5: Generating patches...');
      const patches = await this.diffProposer.savePatches([
        ...this.proposeUnusedImportFixes(importIssues),
        ...this.proposeNamingFixes(ruleBreaches),
      ], scanId);

      // Calculate statistics
      const statistics = {
        totalTodos: todos.length,
        totalImportIssues: importIssues.length,
        totalRouteViolations: routeViolations.length,
        totalRuleBreaches: ruleBreaches.length,
        errorBreaches: ruleBreaches.filter((b: any) => b.severity === 'error')
          .length,
        warningBreaches: ruleBreaches.filter((b: any) => b.severity === 'warning')
          .length,
      };

      const result: AuditResult = {
        scanId,
        timestamp,
        projectRoot: this.projectRoot,
        duration: Date.now() - startTime,
        todos,
        importIssues,
        routeViolations,
        ruleBreaches,
        entropy,
        statistics,
        recommendations: this.generateRecommendations(statistics, entropy),
        patches,
      };

      // Post-processing: generate intelligence-enhanced reports
      await this.enrichAndSaveReports(result, routeViolations, startTime);

      logger.info(`✅ Audit complete with enhanced intelligence. Scan ID: ${scanId}`);
      return result;
    } catch (error) {
      logger.error('❌ Audit failed:', error);
      throw new AuditError(`BackgroundRefactorAgent audit failed for ${scanId}`, { cause: error, scanId });
    }
  }

  /**
   * Quick scan (fast check for critical issues only)
   */
  async runQuickScan(): Promise<Partial<AuditResult>> {
    logger.info('⚡ Running quick scan (critical issues only)...');
    const startTime = Date.now();

    // Only check critical items
    const routesDir = path.join(this.projectRoot, 'server', 'routes');
    const routeViolations = await this.runWithTimeout(
      this.routeAuditor.audit(routesDir),
      30_000,
      'routeAuditor.audit'
    );
    const ruleBreaches = await this.runWithTimeout(
      this.ruleEngine.checkProject(this.userFiles),
      30_000,
      'ruleEngine.checkProject'
    );

    const criticalRouteViolations = routeViolations.filter((v: RouteViolation) => v.severity === 'error');
    const criticalRuleBreaches = ruleBreaches.filter((r: RuleBreach) => r.severity === 'error');

    const critical = [...criticalRouteViolations, ...criticalRuleBreaches];
    logger.info(`🚨 Critical issues found: ${critical.length}`);

    return {
      scanId: `quick-${Date.now()}`,
      timestamp: new Date().toISOString(),
      projectRoot: this.projectRoot,
      duration: Date.now() - startTime,
      routeViolations: criticalRouteViolations,
      ruleBreaches: criticalRuleBreaches,
      entropy: {
        score: Math.min(100, critical.length * 10),
        severity: critical.length > 5 ? 'critical' : 'high',
      },
      statistics: {
        totalTodos: 0,
        totalImportIssues: 0,
        totalRouteViolations: routeViolations.length,
        totalRuleBreaches: ruleBreaches.length,
        errorBreaches: critical.length,
        warningBreaches: 0,
      },
    };
  }

  /**
   * Helper: run a promise with a timeout to avoid hangs
   */
  private async runWithTimeout<T>(p: Promise<T>, ms: number, label?: string): Promise<T> {
    let timer: NodeJS.Timeout;
    const timeout = new Promise<never>((_resolve, reject) => {
      timer = setTimeout(() => reject(new Error(`${label || 'operation'} timed out after ${ms}ms`)), ms);
    });
    try {
      return await Promise.race([p, timeout]) as T;
    } finally {
      clearTimeout(timer!);
    }
  }

  /**
   * Analyze specific file
   */
  async analyzeFile(filePath: string): Promise<any> {
    logger.info(`🔍 Analyzing file: ${filePath}`);

    const todos = this.todoScanner.scanFile(filePath);
    const imports = await this.importValidator.validateFile(filePath);
    const rules = this.ruleEngine.checkFile(filePath);

    return {
      file: filePath,
      todos,
      importIssues: imports,
      ruleBreaches: rules,
    };
  }

  /**
   * Calculate code entropy (0-100 scale)
   */
  private calculateEntropy(issues: any): { score: number; severity: 'critical' | 'high' | 'medium' | 'low' } {
    const weights = {
      todos: 5,
      importIssues: 10,
      routeViolations: 15,
      ruleBreaches: 20,
    };

    const score =
      (issues.todos.length * weights.todos +
        issues.importIssues.length * weights.importIssues +
        issues.routeViolations.length * weights.routeViolations +
        issues.ruleBreaches.length * weights.ruleBreaches) /
      10;

    const clipped = Math.min(100, score);

    const severity: 'critical' | 'high' | 'medium' | 'low' =
      clipped >= 80
        ? 'critical'
        : clipped >= 60
          ? 'high'
          : clipped >= 40
            ? 'medium'
            : 'low';

    return { score: clipped, severity };
  }

  /**
   * Generate patches for unused import fixes
   */
  private proposeUnusedImportFixes(importIssues: any[]) {
    return importIssues
      .filter((i: any) => i.type === 'unused')
      .map((issue: any) => ({
        id: `remove-unused-${uuidv4().slice(0, 8)}`,
        file: issue.file,
        type: 'remove-import' as const,
        description: `Remove unused import: ${issue.importStatement}`,
        originalCode: issue.importStatement,
        fixedCode: '',
        riskLevel: 'low' as const,
        revertCommand: `git checkout -- ${issue.file}`,
      }));
  }

  /**
   * Generate patches for naming violations
   */
  private proposeNamingFixes(breaches: any[]) {
    return breaches
      .filter((b: any) => b.rule?.includes('naming'))
      .map((breach: any) => ({
        id: `fix-naming-${uuidv4().slice(0, 8)}`,
        file: breach.file,
        type: 'rename' as const,
        description: `Fix naming violation: ${breach.message}`,
        originalCode: '/* MANUAL FIX REQUIRED */',
        fixedCode: '/* Review and fix naming to comply with standards */',
        riskLevel: 'high' as const,
        revertCommand: `git checkout -- ${breach.file}`,
      }));
  }

  /**
   * Post-process audit result: generate intelligence reports, export analysis, and finalize run
   */
  private async enrichAndSaveReports(result: AuditResult, routeViolations: RouteViolation[], startTime?: number) {
    logger.info('📄 Generating intelligence-enhanced reports...');

    // Initialize timestamped run directory and integrated tracking
    const runId = await this.reportGenerator.startRun();
    logger.info(`📊 Run ID: ${runId}`);

    // Set external API tracker to save to same run directory
    const runDir = this.reportGenerator.getCurrentRunDir();
    externalAPITracker.setLogDirectory(runDir);

    // Extract raw route data for intelligence enrichment
    logger.info('🧠 Enriching route intelligence...');
    const routeIntelligenceReport = await this.reportGenerator.saveRouteIntelligence(
      routeViolations.map((v) => ({
        path: v.path,
        methods: v.method || 'UNKNOWN',
        methodCount: 1,
        middlewareCount: v.middlewareCount || 0,
        domain: v.domain || 'unknown',
        fullDomain: v.fullDomain || 'unknown.unknown',
      }))
    );
    logger.info(
      `✓ Route intelligence: ${routeIntelligenceReport.summary.totalRoutes} routes, ` +
        `${routeIntelligenceReport.summary.criticalCount} critical, ` +
        `${routeIntelligenceReport.summary.totalMiddlewareGap} middleware gaps`
    );

    // Save audit results with enriched intelligence
    await this.reportGenerator.saveAuditResultsWithIntelligence(result, routeIntelligenceReport);

    // Export API tracking analysis to run directory
    externalAPITracker.exportAnalysis(runDir);

    // Finalize the run with additional metrics from intelligence
    await this.reportGenerator.finalizeRun({
      discoveryTimeMs: Date.now() - (startTime ?? Date.now()),
      modulesScanned: this.userFiles.length,
      routeMetrics: {
        totalRoutes: routeIntelligenceReport.summary.totalRoutes,
        criticalRoutes: routeIntelligenceReport.summary.criticalCount,
        highRiskRoutes: routeIntelligenceReport.summary.highCount,
        middlewareGapTotal: routeIntelligenceReport.summary.totalMiddlewareGap,
        financialRoutes: routeIntelligenceReport.summary.financialRoutes,
      },
    });
  }

  /**
   * Generate actionable recommendations
   */
  private generateRecommendations(
    statistics: any,
    entropy: any
  ): string[] {
    const recommendations: string[] = [];

    if (statistics.totalTodos > 0) {
      recommendations.push(
        `📝 ${statistics.totalTodos} TODOs pending implementation`
      );
    }

    if (statistics.totalImportIssues > 5) {
      recommendations.push(
        `📦 High import inconsistency (${statistics.totalImportIssues} issues). Run import validation`
      );
    }

    if (statistics.totalRouteViolations > 0) {
      recommendations.push(
        `🛣️  ${statistics.totalRouteViolations} route violations found. Review duplicates and consolidate`
      );
    }

    if (statistics.errorBreaches > 0) {
      recommendations.push(
        `⚠️  ${statistics.errorBreaches} CRITICAL rule violations. Immediate action required`
      );
    }

    if (statistics.warningBreaches > 0) {
      recommendations.push(
        `⚠️  ${statistics.warningBreaches} warnings found. Review and fix on next release`
      );
    }

    if (entropy.severity === 'low') {
      recommendations.push(`✅ Code quality is excellent (entropy: ${entropy.score.toFixed(1)}/100)`);
    }

    return recommendations;
  }
}

/**
 * Factory function - run agent as background job
 */
export async function runBackgroundRefactorAgent(
  projectRoot: string
): Promise<AuditResult> {
  const agent = new BackgroundRefactorAgent(projectRoot);
  return agent.runFullAudit();
}

export default BackgroundRefactorAgent;
