/**
 * Route Intelligence Enricher
 * Extends ReportGenerator with structural intelligence:
 * - Per-route risk scoring
 * - Middleware gap analysis
 * - Domain cluster classification
 * - Entropy computation
 * - Enriched schema for MirrorCore-X node graph
 *
 * Drop-in extension for report-generator.ts
 * New output files per run:
 *   route-intelligence.json
 *   domain-intelligence.json
 *   priority-queue.csv
 *   mirror-node-graph.json
 */

import fs from 'fs';
import path from 'path';
import { ReportGenerator, AuditResult } from './ReportGenerator';

// ─────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────

export type RouteCategory =
  | 'financial.vault' | 'financial.wallet' | 'financial.payments'
  | 'financial.escrow' | 'financial.staking'
  | 'governance.proposal' | 'governance.dao' | 'governance.multisig' | 'governance.quorum'
  | 'trading.dex' | 'trading.orders' | 'trading.strategy' | 'trading.market'
  | 'identity.auth' | 'identity.kyc' | 'identity.session' | 'identity.account'
  | 'identity.wallet_setup'
  | 'infra.admin' | 'infra.health' | 'infra.monitoring' | 'infra.ai_engine' | 'infra.sync'
  | 'public' | 'unknown';

export type RiskLevel = 'critical' | 'high' | 'medium' | 'low' | 'info';

export type MiddlewareGap =
  | 'missing_auth'
  | 'missing_rate_limit'
  | 'missing_ownership_check'
  | 'missing_role_check'
  | 'missing_2fa'
  | 'webhook_unverified'
  | 'none';

export interface EnrichedRoute {
  // Original fields (preserved verbatim)
  path: string;
  methods: string;
  methodCount: number;
  middlewareCount: number;
  domain: string;
  fullDomain: string;

  // Computed intelligence
  riskScore: number;                // 0–10
  riskLevel: RiskLevel;
  category: RouteCategory;
  mutates: boolean;                 // Has POST/PUT/PATCH/DELETE
  deletesData: boolean;             // Has DELETE
  financiallyImpactful: boolean;    // Inferred from domain
  requiresOwnership: boolean;       // Path param + financial/governance category
  expectedMinMiddleware: number;    // Floor for category
  middlewareGap: number;            // expectedMinMiddleware - middlewareCount (floored at 0)
  middlewareFlags: MiddlewareGap[]; // Specific missing layers
  isWebhook: boolean;
  isPublic: boolean;
  hasPathParam: boolean;
  mirrorNodeTag: string;            // MirrorCore-X node graph identifier
  auditPriority: 'P0' | 'P1' | 'P2' | 'P3';
  notes: string[];
}

export interface DomainIntelligence {
  domain: string;
  routeCount: number;
  category: RouteCategory;
  avgMiddleware: number;
  avgRiskScore: number;
  topRiskLevel: RiskLevel;
  criticalRoutes: string[];
  highRoutes: string[];
  totalMutatingRoutes: number;
  middlewareGapTotal: number;
  clusterRiskScore: number;         // 0–100 aggregate domain risk
}

export interface RouteIntelligenceReport {
  generatedAt: string;
  runId: string;
  summary: {
    totalRoutes: number;
    totalDomains: number;
    criticalCount: number;
    highCount: number;
    mediumCount: number;
    lowCount: number;
    avgRiskScore: number;
    totalMiddlewareGap: number;
    topRiskDomains: string[];
    financialRoutes: number;
    unauthenticatedFinancialRoutes: number;
    overallEntropyScore: number;    // Feeds into AuditResult.entropy
    overallRiskLevel: RiskLevel;
  };
  domains: DomainIntelligence[];
  routes: EnrichedRoute[];
  priorityQueue: {
    P0: EnrichedRoute[];
    P1: EnrichedRoute[];
    P2: EnrichedRoute[];
    P3: EnrichedRoute[];
  };
}

// ─────────────────────────────────────────────────────────────
// CLASSIFICATION MAPS
// ─────────────────────────────────────────────────────────────

const DOMAIN_CATEGORY_MAP: Record<string, RouteCategory> = {
  // Financial
  'wallet': 'financial.wallet',
  'wallets': 'financial.wallet',
  'wallet-setup': 'identity.wallet_setup',
  'wallet-sessions': 'identity.session',
  'vaults': 'financial.vault',
  'treasury': 'financial.vault',
  'treasury-management': 'financial.vault',
  'treasury-intelligence': 'financial.vault',
  'dao-treasury-flows': 'financial.vault',
  'payments': 'financial.payments',
  'payment-gateway': 'financial.payments',  // Consolidate with payments domain
  'payment-requests': 'financial.payments',  // Consolidate with payments domain
  'payment-reconciliation': 'financial.payments',  // NEW: explicit reconciliation domain
  'payments-reconciliation': 'financial.payments',  // Alias
  'p2p-transfers': 'financial.payments',
  'deposits': 'financial.payments',
  'withdrawals': 'financial.payments',
  'disbursements': 'financial.payments',
  'escrow': 'financial.escrow',
  'bounty-escrow': 'financial.escrow',
  'staking': 'financial.staking',
  'yield-farming': 'financial.staking',
  'investment-pools': 'financial.staking',
  'rebalancing': 'financial.staking',
  'cross-chain': 'financial.wallet',
  // Governance
  'dao': 'governance.dao',
  'daos': 'governance.dao',
  'dao-deploy': 'governance.dao',
  'dao-subscriptions': 'governance.dao',
  'dao-abuse-prevention': 'governance.dao',
  'proposals': 'governance.proposal',
  'poll-proposals': 'governance.proposal',
  'governance': 'governance.proposal',
  'multisig': 'governance.multisig',
  'quorum': 'governance.quorum',
  'delegations': 'governance.dao',
  'delegate': 'governance.dao',
  'pool-governance': 'governance.proposal',
  // Trading
  'dex': 'trading.dex',
  'exchanges': 'trading.market',
  'orders': 'trading.orders',
  'strategies': 'trading.strategy',
  'freqtrade': 'trading.strategy',
  'yuki': 'trading.strategy',
  'v1': 'trading.market',
  'trading': 'trading.market',
  'symbol-universe': 'trading.market',
  // Identity
  'auth': 'identity.auth',
  'account': 'identity.account',
  'kyc': 'identity.kyc',
  'sessions': 'identity.session',
  '2fa': 'identity.auth',
  'pin': 'identity.auth',
  'reputation': 'identity.account',
  'onboarding': 'identity.account',
  'profile': 'identity.account',
  'users': 'identity.account',
  'user': 'identity.account',
  // Infrastructure
  'admin': 'infra.admin',
  'health': 'infra.health',
  'monitoring': 'infra.monitoring',
  'propagation': 'infra.sync',
  'synchronizer': 'infra.sync',
  'agents': 'infra.ai_engine',
  'morio': 'infra.ai_engine',
  'defender': 'infra.monitoring',
  'analyzer': 'infra.ai_engine',
  'ai-analytics': 'infra.ai_engine',
  'analytics': 'infra.monitoring',
};

// Minimum expected middleware count per category
const EXPECTED_MIN_MIDDLEWARE: Record<RouteCategory, number> = {
  'financial.vault': 3,
  'financial.wallet': 2,
  'financial.payments': 2,
  'financial.escrow': 2,
  'financial.staking': 2,
  'governance.proposal': 2,
  'governance.dao': 2,
  'governance.multisig': 2,
  'governance.quorum': 2,
  'trading.dex': 1,
  'trading.orders': 2,
  'trading.strategy': 2,
  'trading.market': 1,
  'identity.auth': 2,
  'identity.kyc': 2,
  'identity.session': 2,
  'identity.account': 2,
  'identity.wallet_setup': 2,
  'infra.admin': 2,
  'infra.health': 2,
  'infra.monitoring': 2,
  'infra.ai_engine': 1,
  'infra.sync': 2,
  'public': 1,
  'unknown': 1,
};

// Base risk score per category (0–10 scale, modified by route-level factors)
const CATEGORY_BASE_RISK: Record<RouteCategory, number> = {
  'financial.vault': 8,
  'financial.wallet': 7,
  'financial.payments': 7,
  'financial.escrow': 7,
  'financial.staking': 6,
  'governance.proposal': 5,
  'governance.dao': 5,
  'governance.multisig': 7,
  'governance.quorum': 4,
  'trading.dex': 4,
  'trading.orders': 5,
  'trading.strategy': 4,
  'trading.market': 2,
  'identity.auth': 6,
  'identity.kyc': 6,
  'identity.session': 5,
  'identity.account': 4,
  'identity.wallet_setup': 8,
  'infra.admin': 7,
  'infra.health': 5,
  'infra.monitoring': 4,
  'infra.ai_engine': 3,
  'infra.sync': 4,
  'public': 1,
  'unknown': 2,
};

// ─────────────────────────────────────────────────────────────
// ENRICHMENT ENGINE
// ─────────────────────────────────────────────────────────────

export class RouteIntelligenceEnricher {

  static enrich(routes: any[]): EnrichedRoute[] {
    return routes.map(r => this.enrichRoute(r));
  }

  private static enrichRoute(r: any): EnrichedRoute {
    const methods = r.methods.split(', ').map((m: string) => m.trim());
    const mutates = methods.some((m: string) => ['POST', 'PUT', 'PATCH', 'DELETE'].includes(m));
    const deletesData = methods.includes('DELETE');
    const hasPathParam = r.path.includes('/:');
    const isWebhook = r.path.includes('webhook') || r.path.includes('callback');
    const isPublic = this.isPublicRoute(r.path, r.domain);

    const category: RouteCategory = DOMAIN_CATEGORY_MAP[r.domain] ?? 'unknown';
    const financiallyImpactful =
      category.startsWith('financial') ||
      r.domain === 'multisig' ||
      r.domain === 'cross-chain';

    // NEW: Detect bulk operations and silent state mutations
    const isBulkOperation = this.isBulkOperation(r.path, r.domain);
    const isSilentMutation = this.isSilentMutation(r.path, r.domain, methods);

    const expectedMinMiddleware = isPublic ? 1 : (EXPECTED_MIN_MIDDLEWARE[category] ?? 1);
    const middlewareGap = Math.max(0, expectedMinMiddleware - r.middlewareCount);
    const middlewareFlags = this.computeMiddlewareFlags(r, category, isWebhook, isPublic, isBulkOperation, isSilentMutation);

    const riskScore = this.computeRiskScore({
      category,
      middlewareGap,
      mutates,
      deletesData,
      financiallyImpactful,
      hasPathParam,
      isWebhook,
      isPublic,
      middlewareCount: r.middlewareCount,
      methodCount: r.methodCount,
      isBulkOperation,
      isSilentMutation,
    });

    const riskLevel = this.toRiskLevel(riskScore);
    const requiresOwnership = hasPathParam && (financiallyImpactful || category.startsWith('governance'));
    const mirrorNodeTag = this.buildMirrorTag(r.path, category, riskLevel);
    const auditPriority = this.toAuditPriority(riskScore, middlewareGap, mutates);
    const notes = this.generateNotes(r, category, middlewareGap, middlewareFlags, riskScore, isBulkOperation, isSilentMutation);

    return {
      path: r.path,
      methods: r.methods,
      methodCount: r.methodCount,
      middlewareCount: r.middlewareCount,
      domain: r.domain,
      fullDomain: r.fullDomain,
      riskScore,
      riskLevel,
      category,
      mutates,
      deletesData,
      financiallyImpactful,
      requiresOwnership,
      expectedMinMiddleware,
      middlewareGap,
      middlewareFlags,
      isWebhook,
      isPublic,
      hasPathParam,
      mirrorNodeTag,
      auditPriority,
      notes,
    };
  }

  private static isPublicRoute(routePath: string, domain: string): boolean {
    const publicDomains = [
      'health', 'api-health', 'api-docs', 'openapi.json',
      'public', 'public-stats', 'blog',
    ];
    const publicPaths = [
      '/health', '/api-health', '/api-docs', '/openapi.json', '/api/public',
    ];
    return (
      publicDomains.includes(domain) ||
      publicPaths.some(p => routePath.startsWith(p))
    );
  }

  /**
   * Detects bulk/batch operations that affect multiple resources in one call.
   * These amplify damage if auth is weak.
   */
  private static isBulkOperation(routePath: string, domain: string): boolean {
    const bulkPatterns = [
      'bulk', 'batch', 'batch-', 'multi-', 'mass-',
      'auto-resolve', 'auto-', 'auto-process',
      'reconcil', 'aggregate', 'batch-process',
    ];
    return bulkPatterns.some(pattern => routePath.toLowerCase().includes(pattern));
  }

  /**
   * Detects operations that alter state without explicit confirmation (silent mutations).
   * Examples: reconciliation, auto-resolution, background tasks.
   */
  private static isSilentMutation(
    routePath: string,
    domain: string,
    methods: string[],
  ): boolean {
    if (!methods.some(m => ['POST', 'PUT', 'PATCH'].includes(m))) return false;

    const silentPatterns = [
      'reconcil', 'auto-', 'auto-reconcil', 'auto-resolve',
      'background', 'process', 'sync', 'propagat',
      'settle', 'finalize', 'confirm-auto',
    ];
    return silentPatterns.some(pattern => routePath.toLowerCase().includes(pattern));
  }

  private static computeMiddlewareFlags(
    r: any,
    category: RouteCategory,
    isWebhook: boolean,
    isPublic: boolean,
    isBulkOperation: boolean = false,
    isSilentMutation: boolean = false,
  ): MiddlewareGap[] {
    if (isPublic) return ['none'];
    const flags: MiddlewareGap[] = [];

    if (r.middlewareCount <= 1 && !isWebhook) {
      if (category.startsWith('financial') || category === 'identity.wallet_setup') {
        flags.push('missing_auth');
      }
      if (category === 'infra.admin') {
        flags.push('missing_role_check');
      }
      if (category === 'identity.auth') {
        flags.push('missing_rate_limit');
      }
    }

    if (isWebhook && r.middlewareCount < 1) {
      flags.push('webhook_unverified');
    }

    const methods: string[] = r.methods.split(', ');
    const isHighValueMutation = methods.some(m => ['POST', 'DELETE'].includes(m));
    if (
      isHighValueMutation &&
      r.middlewareCount <= 1 &&
      (category.startsWith('financial') || category === 'governance.multisig')
    ) {
      if (!flags.includes('missing_2fa')) flags.push('missing_2fa');
      if (!flags.includes('missing_ownership_check')) flags.push('missing_ownership_check');
    }

    // NEW: Bulk operations & silent mutations need extra auth layers
    if ((isBulkOperation || isSilentMutation) && r.middlewareCount <= 1 && category.startsWith('financial')) {
      if (!flags.includes('missing_auth')) flags.push('missing_auth');
      if (!flags.includes('missing_2fa')) flags.push('missing_2fa');
      // bulk financial calls should also have a role check
      if (!flags.includes('missing_role_check')) flags.push('missing_role_check');
    }

    return flags.length === 0 ? ['none'] : flags;
  }

  private static computeRiskScore(params: {
    category: RouteCategory;
    middlewareGap: number;
    mutates: boolean;
    deletesData: boolean;
    financiallyImpactful: boolean;
    hasPathParam: boolean;
    isWebhook: boolean;
    isPublic: boolean;
    middlewareCount: number;
    methodCount: number;
    isBulkOperation?: boolean;
    isSilentMutation?: boolean;
  }): number {
    if (params.isPublic) return 1.0;

    let score = CATEGORY_BASE_RISK[params.category] ?? 2;

    // Each missing middleware layer is a significant gap
    score += params.middlewareGap * 0.8;

    // Mutation penalties
    if (params.mutates) score += 0.5;
    if (params.deletesData) score += 0.8;
    if (params.financiallyImpactful) score += 0.5;

    // Multi-method routes expand attack surface
    if (params.methodCount > 1) score += 0.3 * (params.methodCount - 1);

    // Unverified webhooks
    if (params.isWebhook && params.middlewareCount < 2) score += 1.0;

    // NEW: Bulk operations amplify the blast radius
    if (params.isBulkOperation && params.middlewareCount <= 1) score += 1.5;

    // NEW: Silent mutations (auto-reconciliation, background processing)
    // are particularly dangerous because they bypass user confirmation
    if (params.isSilentMutation && params.middlewareCount <= 1) score += 1.2;

    // Silent mutation on bulk operation is critical
    if (params.isBulkOperation && params.isSilentMutation && params.financiallyImpactful) {
      score += 2.0;
    }

    return Math.min(10, Math.max(0, parseFloat(score.toFixed(1))));
  }

  private static toRiskLevel(score: number): RiskLevel {
    if (score >= 9) return 'critical';
    if (score >= 7) return 'high';
    if (score >= 5) return 'medium';
    if (score >= 3) return 'low';
    return 'info';
  }

  private static toAuditPriority(
    riskScore: number,
    middlewareGap: number,
    mutates: boolean,
  ): 'P0' | 'P1' | 'P2' | 'P3' {
    if (riskScore >= 9 && middlewareGap > 0) return 'P0';
    if (riskScore >= 7 && (middlewareGap > 0 || mutates)) return 'P1';
    if (riskScore >= 5) return 'P2';
    return 'P3';
  }

  private static buildMirrorTag(
    routePath: string,
    category: RouteCategory,
    risk: RiskLevel,
  ): string {
    const parts = routePath
      .replace('/api/', '')
      .split('/')
      .filter(p => !p.startsWith(':'));
    const slug = parts.slice(0, 3).join('_').replace(/-/g, '_');
    return `${category.replace('.', '/')}.${slug}.${risk}`;
  }

  private static generateNotes(
    r: any,
    category: RouteCategory,
    middlewareGap: number,
    flags: MiddlewareGap[],
    riskScore: number,
    isBulkOperation: boolean = false,
    isSilentMutation: boolean = false,
  ): string[] {
    const notes: string[] = [];

    if (middlewareGap > 0) {
      notes.push(
        `Middleware deficit: ${r.middlewareCount} present, ` +
        `${r.middlewareCount + middlewareGap} expected for ${category}`
      );
    }
    if (flags.includes('missing_auth')) {
      notes.push('No authentication middleware detected on financial route');
    }
    if (flags.includes('missing_role_check')) {
      notes.push('Admin domain without role enforcement middleware');
    }
    if (flags.includes('missing_2fa')) {
      notes.push('High-value mutation missing 2FA/confirmation layer');
    }
    if (flags.includes('missing_ownership_check')) {
      notes.push('Parameterized route lacks ownership validation middleware');
    }
    
    // NEW: Bulk operation warnings
    if (isBulkOperation && r.middlewareCount <= 1) {
      notes.push(
        `(CRITICAL) Bulk operation with ${r.middlewareCount} middleware — ` +
        `affects multiple resources; requires auth + rate limiting + audit trail`
      );
    }

    // NEW: Silent mutation warnings
    if (isSilentMutation && r.middlewareCount <= 1) {
      notes.push(
        `(CRITICAL) Silent state mutation (reconciliation/auto-resolve) with ${r.middlewareCount} middleware — ` +
        `bypasses user confirmation; requires strict auth + audit logging`
      );
    }

    // Silent bulk mutation is the worst case
    if (isBulkOperation && isSilentMutation && category.startsWith('financial')) {
      notes.push(
        `(CRITICAL) Silent bulk operation on payment reconciliation — ` +
        `can alter multiple payment states without audit trail; immediate remediation required`
      );
    }

    if (r.methodCount > 2) {
      notes.push(`Multi-method route (${r.methods}) — split for cleaner access control`);
    }
    if (riskScore >= 9) {
      notes.push('P0: Immediate remediation required before production traffic');
    }

    return notes;
  }
}

// ─────────────────────────────────────────────────────────────
// DOMAIN AGGREGATOR
// ─────────────────────────────────────────────────────────────

export class DomainAggregator {

  static aggregate(enrichedRoutes: EnrichedRoute[]): DomainIntelligence[] {
    const byDomain = new Map<string, EnrichedRoute[]>();

    for (const route of enrichedRoutes) {
      const list = byDomain.get(route.domain) ?? [];
      list.push(route);
      byDomain.set(route.domain, list);
    }

    const results: DomainIntelligence[] = [];

    for (const [domain, routes] of byDomain.entries()) {
      const avgMiddleware = routes.reduce((s, r) => s + r.middlewareCount, 0) / routes.length;
      const avgRiskScore  = routes.reduce((s, r) => s + r.riskScore, 0) / routes.length;
      const criticalRoutes = routes.filter(r => r.riskLevel === 'critical').map(r => r.path);
      const highRoutes     = routes.filter(r => r.riskLevel === 'high').map(r => r.path);
      const totalMutatingRoutes = routes.filter(r => r.mutates).length;
      const middlewareGapTotal  = routes.reduce((s, r) => s + r.middlewareGap, 0);

      const topRiskLevel: RiskLevel =
        criticalRoutes.length > 0 ? 'critical' :
        highRoutes.length > 0 ? 'high' :
        routes.some(r => r.riskLevel === 'medium') ? 'medium' : 'low';

      // Cluster risk: avg risk (weighted) + gap penalty + mutation density + critical amplifier
      const clusterRiskScore = Math.min(100, Math.round(
        avgRiskScore * 6 +
        middlewareGapTotal * 2 +
        (totalMutatingRoutes / routes.length) * 10 +
        criticalRoutes.length * 8
      ));

      results.push({
        domain,
        routeCount: routes.length,
        category: routes[0]?.category ?? 'unknown',
        avgMiddleware: parseFloat(avgMiddleware.toFixed(2)),
        avgRiskScore: parseFloat(avgRiskScore.toFixed(2)),
        topRiskLevel,
        criticalRoutes,
        highRoutes,
        totalMutatingRoutes,
        middlewareGapTotal,
        clusterRiskScore,
      });
    }

    // Hottest domains first
    return results.sort((a, b) => b.clusterRiskScore - a.clusterRiskScore);
  }
}

// ─────────────────────────────────────────────────────────────
// INTELLIGENT REPORT GENERATOR
// Extends ReportGenerator — drop-in replacement
// ─────────────────────────────────────────────────────────────

export class IntelligentReportGenerator extends ReportGenerator {

  /**
   * Enrich routes and write all intelligence files to the current run directory.
   * Call this after startRun(), before finalizeRun().
   */
  async saveRouteIntelligence(rawRoutes: any[]): Promise<RouteIntelligenceReport> {
    const runDir = this.getCurrentRunDir();
    if (!runDir) {
      throw new Error('Run not initialized. Call startRun() first.');
    }

    const enriched = RouteIntelligenceEnricher.enrich(rawRoutes);
    const domains  = DomainAggregator.aggregate(enriched);

    const criticalCount = enriched.filter(r => r.riskLevel === 'critical').length;
    const highCount     = enriched.filter(r => r.riskLevel === 'high').length;
    const mediumCount   = enriched.filter(r => r.riskLevel === 'medium').length;
    const lowCount      = enriched.filter(r => r.riskLevel === 'low').length;
    const avgRiskScore  = enriched.reduce((s, r) => s + r.riskScore, 0) / enriched.length;
    const totalMiddlewareGap = enriched.reduce((s, r) => s + r.middlewareGap, 0);
    const financialRoutes = enriched.filter(r => r.financiallyImpactful).length;
    const unauthenticatedFinancialRoutes = enriched.filter(
      r => r.financiallyImpactful && r.middlewareCount <= 1
    ).length;
    const topRiskDomains = domains.slice(0, 10).map(d => d.domain);

    // Entropy: avg risk + gap density + critical/high amplifiers
    const overallEntropyScore = Math.min(100, Math.round(
      avgRiskScore * 5 +
      (totalMiddlewareGap / enriched.length) * 20 +
      criticalCount * 2 +
      highCount * 0.5
    ));

    const overallRiskLevel: RiskLevel =
      overallEntropyScore >= 70 ? 'critical' :
      overallEntropyScore >= 50 ? 'high' :
      overallEntropyScore >= 30 ? 'medium' : 'low';

    const priorityQueue = {
      P0: enriched.filter(r => r.auditPriority === 'P0'),
      P1: enriched.filter(r => r.auditPriority === 'P1'),
      P2: enriched.filter(r => r.auditPriority === 'P2'),
      P3: enriched.filter(r => r.auditPriority === 'P3'),
    };

    const report: RouteIntelligenceReport = {
      generatedAt: new Date().toISOString(),
      runId: this.getCurrentRunId(),
      summary: {
        totalRoutes: enriched.length,
        totalDomains: domains.length,
        criticalCount,
        highCount,
        mediumCount,
        lowCount,
        avgRiskScore: parseFloat(avgRiskScore.toFixed(2)),
        totalMiddlewareGap,
        topRiskDomains,
        financialRoutes,
        unauthenticatedFinancialRoutes,
        overallEntropyScore,
        overallRiskLevel,
      },
      domains,
      routes: enriched,
      priorityQueue,
    };

    // Write all four intelligence files in parallel
    await Promise.all([
      fs.promises.writeFile(
        path.join(runDir, 'route-intelligence.json'),
        JSON.stringify(report, null, 2),
      ),
      fs.promises.writeFile(
        path.join(runDir, 'domain-intelligence.json'),
        JSON.stringify(
          { generatedAt: report.generatedAt, summary: report.summary, domains },
          null, 2,
        ),
      ),
      fs.promises.writeFile(
        path.join(runDir, 'priority-queue.csv'),
        this.buildPriorityCSV(priorityQueue),
      ),
      fs.promises.writeFile(
        path.join(runDir, 'mirror-node-graph.json'),
        JSON.stringify(this.buildMirrorGraph(enriched), null, 2),
      ),
    ]);

    return report;
  }

  /**
   * Replaces saveAuditResults — injects entropy score from route intelligence
   * so the HTML report entropy value is grounded in actual middleware gap data.
   */
  async saveAuditResultsWithIntelligence(
    result: AuditResult,
    routeReport: RouteIntelligenceReport,
  ): Promise<void> {
    const enriched: AuditResult = {
      ...result,
      entropy: {
        score: routeReport.summary.overallEntropyScore,
        severity: routeReport.summary.overallRiskLevel,
      },
      recommendations: [
        ...result.recommendations,
        ...this.buildIntelligenceRecommendations(routeReport),
      ],
    };
    await this.saveAuditResults(enriched);
  }

  // ── Private builders ────────────────────────────────────────

  private buildPriorityCSV(
    pq: RouteIntelligenceReport['priorityQueue'],
  ): string {
    let csv = 'Priority,Path,Methods,Domain,Category,RiskScore,MiddlewareGap,Flags,Notes\n';
    for (const [priority, routes] of Object.entries(pq)) {
      for (const r of routes as EnrichedRoute[]) {
        const flags = r.middlewareFlags.join(' | ');
        const notes = r.notes.join(' | ').replace(/"/g, "'");
        csv +=
          `${priority},` +
          `"${r.path}",` +
          `"${r.methods}",` +
          `${r.domain},` +
          `${r.category},` +
          `${r.riskScore},` +
          `${r.middlewareGap},` +
          `"${flags}",` +
          `"${notes}"\n`;
      }
    }
    return csv;
  }

  private buildMirrorGraph(routes: EnrichedRoute[]): object {
    return {
      schema: 'mirror-node-graph-v1',
      nodes: routes.map(r => ({
        id: r.mirrorNodeTag,
        path: r.path,
        methods: r.methods.split(', '),
        category: r.category,
        risk: r.riskScore,
        mw: r.middlewareCount,
        gap: r.middlewareGap,
        mutates: r.mutates,
        financial: r.financiallyImpactful,
        priority: r.auditPriority,
      })),
      edges: this.buildDomainEdges(routes),
      meta: {
        totalNodes: routes.length,
        generatedAt: new Date().toISOString(),
      },
    };
  }

  private buildDomainEdges(routes: EnrichedRoute[]): object[] {
    const domains = new Set(routes.map(r => r.domain));
    const edges: object[] = [];
    for (const domain of domains) {
      for (const route of routes.filter(r => r.domain === domain)) {
        edges.push({
          from: `domain::${domain}`,
          to: route.mirrorNodeTag,
          weight: route.riskScore,
        });
      }
    }
    return edges;
  }

  private buildIntelligenceRecommendations(
    report: RouteIntelligenceReport,
  ): string[] {
    const recs: string[] = [];
    const { summary, priorityQueue } = report;

    if (summary.unauthenticatedFinancialRoutes > 0) {
      recs.push(
        `🔴 ${summary.unauthenticatedFinancialRoutes} financial routes have ≤1 middleware — immediate auth gate required`
      );
    }
    if (priorityQueue.P0.length > 0) {
      recs.push(`🔴 P0: ${priorityQueue.P0.length} routes require immediate remediation`);
    }
    if (priorityQueue.P1.length > 0) {
      recs.push(`🟠 P1: ${priorityQueue.P1.length} routes require remediation this sprint`);
    }
    if (summary.totalMiddlewareGap > 50) {
      recs.push(
        `Middleware coverage gap is ${summary.totalMiddlewareGap} layers across all routes — systematic auth audit required`
      );
    }
    if (summary.overallEntropyScore >= 70) {
      recs.push(
        `System entropy is CRITICAL (${summary.overallEntropyScore}/100) — architecture review needed`
      );
    }

    const topDomain = report.domains[0];
    if (topDomain && topDomain.clusterRiskScore >= 80) {
      recs.push(
        `Domain '${topDomain.domain}' cluster risk ${topDomain.clusterRiskScore}/100 — isolate and harden`
      );
    }

    // NEW: Architectural observation about bulk/silent payment operations
    const bulkPaymentRoutes = report.routes.filter(
      r => r.category === 'financial.payments' && 
      (r.path.toLowerCase().includes('bulk') || 
       r.path.toLowerCase().includes('auto-reconcil') ||
       r.path.toLowerCase().includes('auto-resolve'))
    );
    if (bulkPaymentRoutes.some(r => r.middlewareCount <= 1)) {
      recs.push(
        `🔴 PAYMENT RECONCILIATION: Bulk/auto-resolve payment operations detected with 1 middleware only — ` +
        `these can silently mutate payment state. Require explicit auth + audit + confirmation layer`
      );
    }

    // NEW: Domain consolidation recommendation
    const paymentDomains = report.domains.filter(
      d => d.domain === 'payments' || d.domain === 'payment-gateway' || d.domain === 'payment-requests'
    );
    if (paymentDomains.length > 1) {
      recs.push(
        `🟡 ARCHITECTURAL: Payment domain is fragmented across ${paymentDomains.map(d => d.domain).join(', ')} — ` +
        `consolidate under single 'financial.payments' namespace for consistent security baseline`
      );
    }

    return recs;
  }

  /**
   * Analyze drift between two consecutive run snapshots.
   * Loads `route-intelligence.json` from runDir/run-{prev}/ and runDir/run-{curr}/
   * Returns behavioral drift report and saves drift-analysis.json to current run.
   */
  async analyzeDrift(
    runBaseDir: string,
    previousRunId: string,
    currentRunId: string,
  ): Promise<DriftAnalysisReport> {
    const driftReport = await HistoricalDriftDetector.loadAndDetectFromRunDirectory(
      runBaseDir,
      previousRunId,
      currentRunId,
    );

    const runDir = this.getCurrentRunDir();
    if (runDir) {
      await fs.promises.writeFile(
        path.join(runDir, 'drift-analysis.json'),
        JSON.stringify(driftReport, null, 2),
      );
    }

    return driftReport;
  }

  /**
   * Analyze API surface topology from the mirror-node-graph.json.
   * Computes centrality metrics, identifies bottlenecks, and fragmentation.
   * Saves topology-analysis.json to current run.
   */
  async analyzeTopology(): Promise<GraphTopologyReport> {
    const runDir = this.getCurrentRunDir();
    if (!runDir) {
      throw new Error('Run not initialized. Call startRun() first.');
    }

    const topologyReport = await CentralityAnalyzer.loadAndAnalyzeFromRunDirectory(runDir);

    await fs.promises.writeFile(
      path.join(runDir, 'topology-analysis.json'),
      JSON.stringify(topologyReport, null, 2),
    );

    return topologyReport;
  }

  /**
   * Run full enrichment pipeline: generate route intelligence, analyze topology, detect drift.
   * Call order: startRun() → enrichAndAnalyze(rawRoutes, prevRunId) → finalizeRun()
   */
  async enrichAndAnalyze(
    rawRoutes: any[],
    previousRunId?: string,
  ): Promise<{
    routeIntelligence: RouteIntelligenceReport;
    topologyAnalysis: GraphTopologyReport;
    driftAnalysis?: DriftAnalysisReport;
  }> {
    // Step 1: Enrich routes
    const routeIntelligence = await this.saveRouteIntelligence(rawRoutes);

    // Step 2: Analyze topology from mirror graph
    const topologyAnalysis = await this.analyzeTopology();

    // Step 3: Detect drift if previous run specified
    let driftAnalysis: DriftAnalysisReport | undefined;
    if (previousRunId) {
      const runDir = this.getCurrentRunDir();
      if (runDir) {
        const parentDir = path.dirname(runDir);
        driftAnalysis = await this.analyzeDrift(parentDir, previousRunId, this.getCurrentRunId());
      }
    }

    return {
      routeIntelligence,
      topologyAnalysis,
      driftAnalysis,
    };
  }
}

// ─────────────────────────────────────────────────────────────
// HISTORICAL DRIFT DETECTOR
// Behavioral alarm system: compares consecutive run snapshots
// Detects middleware loss, topology shifts, risk regressions
// ─────────────────────────────────────────────────────────────

export interface RouteDrift {
  path: string;
  domain: string;
  driftType: 'middleware_loss' | 'risk_increase' | 'route_removal' | 'new_route' | 'middleware_gain';
  previousValue?: any;
  currentValue?: any;
  severity: 'critical' | 'high' | 'medium' | 'low';
  changePercent?: number;
}

export interface DomainDrift {
  domain: string;
  driftType: 'appearance' | 'disappearance' | 'cluster_risk_increase' | 'route_count_change';
  previousMetrics?: Record<string, any>;
  currentMetrics?: Record<string, any>;
  severity: 'critical' | 'high' | 'medium' | 'low';
}

export interface DriftAnalysisReport {
  comparisonRunIDs: [string, string];
  generatedAt: string;
  overallDriftScore: number;        // 0–100: how much the API surface changed
  routeDrifts: RouteDrift[];
  domainDrifts: DomainDrift[];
  criticalAlerts: string[];         // Silent alarms: immediate action items
  summary: {
    routesDegraded: number;
    routesImproved: number;
    routesRemoved: number;
    routesAdded: number;
    domainsAppeared: number;
    domainsDisappeared: number;
    middlewareLossCount: number;
    totalRiskShift: number;          // Sum of all risk deltas
  };
}

export class HistoricalDriftDetector {

  /**
   * Compare two RouteIntelligenceReport snapshots.
   * Returns structured drift that triggers alerts on breaking changes.
   */
  static detectDrift(
    previousReport: RouteIntelligenceReport,
    currentReport: RouteIntelligenceReport,
  ): DriftAnalysisReport {
    const routeDrifts = this.compareRoutes(previousReport, currentReport);
    const domainDrifts = this.compareDomains(previousReport, currentReport);
    const overallDriftScore = this.computeDriftScore(routeDrifts, domainDrifts);
    const criticalAlerts = this.generateCriticalAlerts(routeDrifts, domainDrifts);

    const summary = {
      routesDegraded: routeDrifts.filter(r => r.driftType === 'middleware_loss' || r.driftType === 'risk_increase').length,
      routesImproved: routeDrifts.filter(r => r.driftType === 'middleware_gain').length,
      routesRemoved: routeDrifts.filter(r => r.driftType === 'route_removal').length,
      routesAdded: routeDrifts.filter(r => r.driftType === 'new_route').length,
      domainsAppeared: domainDrifts.filter(r => r.driftType === 'appearance').length,
      domainsDisappeared: domainDrifts.filter(r => r.driftType === 'disappearance').length,
      middlewareLossCount: routeDrifts.filter(r => r.driftType === 'middleware_loss').length,
      totalRiskShift: routeDrifts.reduce((sum, r) => sum + (r.changePercent || 0), 0),
    };

    return {
      comparisonRunIDs: [previousReport.runId, currentReport.runId],
      generatedAt: new Date().toISOString(),
      overallDriftScore,
      routeDrifts,
      domainDrifts,
      criticalAlerts,
      summary,
    };
  }

  private static compareRoutes(
    prevReport: RouteIntelligenceReport,
    currReport: RouteIntelligenceReport,
  ): RouteDrift[] {
    const drifts: RouteDrift[] = [];
    const prevByPath = new Map(prevReport.routes.map(r => [r.path, r]));
    const currByPath = new Map(currReport.routes.map(r => [r.path, r]));

    // Detect removals and regressions in existing routes
    for (const [path, prevRoute] of prevByPath.entries()) {
      const currRoute = currByPath.get(path);
      if (!currRoute) {
        drifts.push({
          path,
          domain: prevRoute.domain,
          driftType: 'route_removal',
          previousValue: { middlewareCount: prevRoute.middlewareCount, riskScore: prevRoute.riskScore },
          severity: prevRoute.riskLevel === 'critical' ? 'critical' : 'medium',
        });
        continue;
      }

      // Middleware loss between runs
      if (currRoute.middlewareCount < prevRoute.middlewareCount) {
        const loss = prevRoute.middlewareCount - currRoute.middlewareCount;
        drifts.push({
          path,
          domain: prevRoute.domain,
          driftType: 'middleware_loss',
          previousValue: prevRoute.middlewareCount,
          currentValue: currRoute.middlewareCount,
          severity: loss >= 2 || prevRoute.financiallyImpactful ? 'critical' : 'high',
          changePercent: -((loss / prevRoute.middlewareCount) * 100),
        });
      }

      // Risk increase
      if (currRoute.riskScore > prevRoute.riskScore) {
        const increase = currRoute.riskScore - prevRoute.riskScore;
        drifts.push({
          path,
          domain: prevRoute.domain,
          driftType: 'risk_increase',
          previousValue: prevRoute.riskScore,
          currentValue: currRoute.riskScore,
          severity: increase >= 2 ? 'critical' : increase >= 1 ? 'high' : 'medium',
          changePercent: (increase / prevRoute.riskScore) * 100,
        });
      }

      // Middleware improvements (positive signal)
      if (currRoute.middlewareCount > prevRoute.middlewareCount) {
        drifts.push({
          path,
          domain: prevRoute.domain,
          driftType: 'middleware_gain',
          previousValue: prevRoute.middlewareCount,
          currentValue: currRoute.middlewareCount,
          severity: 'low',
          changePercent: (currRoute.middlewareCount / prevRoute.middlewareCount) * 100,
        });
      }
    }

    // Detect new routes
    for (const [path, currRoute] of currByPath.entries()) {
      if (!prevByPath.has(path)) {
        drifts.push({
          path,
          domain: currRoute.domain,
          driftType: 'new_route',
          currentValue: { middlewareCount: currRoute.middlewareCount, riskScore: currRoute.riskScore, category: currRoute.category },
          severity: currRoute.riskLevel === 'critical' ? 'critical' : currRoute.riskLevel === 'high' ? 'high' : 'low',
        });
      }
    }

    return drifts.sort((a, b) => {
      const severityWeight = { critical: 3, high: 2, medium: 1, low: 0 };
      return severityWeight[b.severity] - severityWeight[a.severity];
    });
  }

  private static compareDomains(
    prevReport: RouteIntelligenceReport,
    currReport: RouteIntelligenceReport,
  ): DomainDrift[] {
    const drifts: DomainDrift[] = [];
    const prevByDomain = new Map(prevReport.domains.map(d => [d.domain, d]));
    const currByDomain = new Map(currReport.domains.map(d => [d.domain, d]));

    // Disappearances
    for (const [domain, prevDomain] of prevByDomain.entries()) {
      if (!currByDomain.has(domain)) {
        drifts.push({
          domain,
          driftType: 'disappearance',
          previousMetrics: {
            routeCount: prevDomain.routeCount,
            clusterRiskScore: prevDomain.clusterRiskScore,
            avgRiskScore: prevDomain.avgRiskScore,
          },
          severity: prevDomain.clusterRiskScore >= 70 ? 'high' : 'low',
        });
      }
    }

    // Appearances
    for (const [domain, currDomain] of currByDomain.entries()) {
      if (!prevByDomain.has(domain)) {
        drifts.push({
          domain,
          driftType: 'appearance',
          currentMetrics: {
            routeCount: currDomain.routeCount,
            clusterRiskScore: currDomain.clusterRiskScore,
            avgRiskScore: currDomain.avgRiskScore,
          },
          severity: currDomain.clusterRiskScore >= 80 ? 'critical' : currDomain.clusterRiskScore >= 50 ? 'high' : 'low',
        });
      }
    }

    // Risk increases in existing domains
    for (const [domain, prevDomain] of prevByDomain.entries()) {
      const currDomain = currByDomain.get(domain);
      if (currDomain) {
        const riskDelta = currDomain.clusterRiskScore - prevDomain.clusterRiskScore;
        if (riskDelta > 10) {
          drifts.push({
            domain,
            driftType: 'cluster_risk_increase',
            previousMetrics: { clusterRiskScore: prevDomain.clusterRiskScore, routeCount: prevDomain.routeCount },
            currentMetrics: { clusterRiskScore: currDomain.clusterRiskScore, routeCount: currDomain.routeCount },
            severity: riskDelta >= 30 ? 'critical' : riskDelta >= 20 ? 'high' : 'medium',
          });
        }

        // Route count changes
        const countDelta = Math.abs(currDomain.routeCount - prevDomain.routeCount);
        if (countDelta > 2) {
          drifts.push({
            domain,
            driftType: 'route_count_change',
            previousMetrics: { routeCount: prevDomain.routeCount, clusterRiskScore: prevDomain.clusterRiskScore },
            currentMetrics: { routeCount: currDomain.routeCount, clusterRiskScore: currDomain.clusterRiskScore },
            severity: 'low',
          });
        }
      }
    }

    return drifts.sort((a, b) => {
      const severityWeight = { critical: 3, high: 2, medium: 1, low: 0 };
      return severityWeight[b.severity] - severityWeight[a.severity];
    });
  }

  private static computeDriftScore(
    routeDrifts: RouteDrift[],
    domainDrifts: DomainDrift[],
  ): number {
    const criticalRoute = routeDrifts.filter(r => r.severity === 'critical').length * 15;
    const highRoute = routeDrifts.filter(r => r.severity === 'high').length * 8;
    const mediumRoute = routeDrifts.filter(r => r.severity === 'medium').length * 3;

    const criticalDomain = domainDrifts.filter(d => d.severity === 'critical').length * 12;
    const highDomain = domainDrifts.filter(d => d.severity === 'high').length * 6;
    const mediumDomain = domainDrifts.filter(d => d.severity === 'medium').length * 2;

    return Math.min(100, criticalRoute + highRoute + mediumRoute + criticalDomain + highDomain + mediumDomain);
  }

  private static generateCriticalAlerts(
    routeDrifts: RouteDrift[],
    domainDrifts: DomainDrift[],
  ): string[] {
    const alerts: string[] = [];

    const middlewareLoss = routeDrifts.filter(r => r.driftType === 'middleware_loss' && r.severity === 'critical');
    if (middlewareLoss.length > 0) {
      alerts.push(
        `🚨 MIDDLEWARE LOSS: ${middlewareLoss.length} route(s) lost critical auth layers — ` +
        `${middlewareLoss.map(r => r.path).join(', ')}`
      );
    }

    const newCritical = routeDrifts.filter(r => r.driftType === 'new_route' && r.severity === 'critical');
    if (newCritical.length > 0) {
      alerts.push(
        `🚨 NEW HIGH-RISK ROUTE: ${newCritical.length} unvetted critical route(s) appeared in current run`
      );
    }

    const domainAppearanceRisk = domainDrifts.filter(r => r.driftType === 'appearance' && r.severity === 'critical');
    if (domainAppearanceRisk.length > 0) {
      alerts.push(
        `🚨 CRITICAL DOMAIN: New domain '${domainAppearanceRisk[0].domain}' with risk score ≥80 — needs immediate audit`
      );
    }

    const majorRiskShift = domainDrifts.filter(r => r.driftType === 'cluster_risk_increase' && r.severity === 'critical');
    if (majorRiskShift.length > 0) {
      alerts.push(
        `🚨 DOMAIN DEGRADATION: ${majorRiskShift.map(r => r.domain).join(', ')} risk increased by ≥30 points`
      );
    }

    const removed = routeDrifts.filter(r => r.driftType === 'route_removal' && r.severity === 'critical');
    if (removed.length > 0) {
      alerts.push(
        `⚠️ CRITICAL ROUTE REMOVED: ${removed.length} high-risk route(s) no longer present — verify intentional decommission`
      );
    }

    return alerts;
  }

  /**
   * Load two consecutive run snapshots from disk and detect drift.
   */
  static async loadAndDetectFromRunDirectory(
    runBaseDir: string,
    prevRunId: string,
    currRunId: string,
  ): Promise<DriftAnalysisReport> {
    const prevPath = path.join(runBaseDir, `run-${prevRunId}`, 'route-intelligence.json');
    const currPath = path.join(runBaseDir, `run-${currRunId}`, 'route-intelligence.json');

    const prevReport = JSON.parse(await fs.promises.readFile(prevPath, 'utf8'));
    const currReport = JSON.parse(await fs.promises.readFile(currPath, 'utf8'));

    return this.detectDrift(prevReport, currReport);
  }
}

// ─────────────────────────────────────────────────────────────
// CENTRALITY ANALYZER
// Graph topology analysis: identifies bottlenecks, hubs, fragmentation
// ─────────────────────────────────────────────────────────────

export interface NodeCentrality {
  nodeId: string;
  nodeType: 'route' | 'domain';
  path?: string;
  degreeCentrality: number;         // 0–1: how many edges
  betweennesCentrality: number;     // 0–1: path bridging importance (approximation)
  clusteringCoefficient: number;    // 0–1: local clustering
  riskWeighted: number;             // Centrality × risk score
  criticality: 'critical' | 'high' | 'medium' | 'low';
}

export interface GraphTopologyReport {
  generatedAt: string;
  runId: string;
  totalNodes: number;
  totalEdges: number;
  nodesByType: { routes: number; domains: number };
  nodesByRiskLevel: Record<string, number>;
  centralityRanking: NodeCentrality[];
  bottlenecks: {
    domainBottlenecks: Array<{ domain: string; routeCount: number; avgRiskScore: number }>;
    routeBottlenecks: Array<{ path: string; betweenness: number; risk: number }>;
  };
  fragmentation: {
    isolatedDomains: string[];
    isolatedRoutes: string[];
    densityClusters: Array<{ domain: string; internalDensity: number }>;
  };
  topologyNotes: string[];
}

export class CentralityAnalyzer {

  /**
   * Parse mirror-node-graph.json and compute centrality metrics.
   */
  static analyzeTopology(mirrorGraph: any): GraphTopologyReport {
    if (!mirrorGraph.nodes || !mirrorGraph.edges) {
      throw new Error('Invalid mirror-node-graph: missing nodes or edges');
    }

    const nodes = mirrorGraph.nodes as any[];
    const edges = mirrorGraph.edges as any[];

    // Build adjacency representations
    const adjList = new Map<string, string[]>();
    const edgeWeights = new Map<string, number>();
    const nodeMap = new Map<string, any>();
    const domainNodes = new Map<string, string[]>();

    for (const node of nodes) {
      adjList.set(node.id, []);
      nodeMap.set(node.id, node);
      // Group route nodes by domain
      if (node.path) {
        const domain = node.category.split('.')[0];
        const routes = domainNodes.get(domain) ?? [];
        routes.push(node.id);
        domainNodes.set(domain, routes);
      }
    }

    for (const edge of edges) {
      const { from, to, weight } = edge;
      adjList.get(from)?.push(to);
      adjList.get(to)?.push(from);
      edgeWeights.set(`${from}:${to}`, weight ?? 1);
      edgeWeights.set(`${to}:${from}`, weight ?? 1);
    }

    // Compute centralities
    const centralities = this.computeCentralities(nodes, adjList, edgeWeights, nodeMap);
    const bottlenecks = this.identifyBottlenecks(centralities, domainNodes, nodeMap);
    const fragmentation = this.analyzeFragmentation(nodes, adjList, domainNodes);
    const topologyNotes = this.generateTopologyNotes(centralities, bottlenecks, fragmentation, nodes.length);

    // Risk-weighted ranking
    centralities.sort((a, b) => b.riskWeighted - a.riskWeighted);

    return {
      generatedAt: new Date().toISOString(),
      runId: mirrorGraph.meta?.generatedAt || 'unknown',
      totalNodes: nodes.length,
      totalEdges: edges.length,
      nodesByType: {
        routes: nodes.filter(n => n.path).length,
        domains: nodes.filter(n => n.path === undefined).length,
      },
      nodesByRiskLevel: this.countRiskLevels(nodes),
      centralityRanking: centralities,
      bottlenecks,
      fragmentation,
      topologyNotes,
    };
  }

  private static computeCentralities(
    nodes: any[],
    adjList: Map<string, string[]>,
    edgeWeights: Map<string, number>,
    nodeMap: Map<string, any>,
  ): NodeCentrality[] {
    const results: NodeCentrality[] = [];
    const totalNodes = nodes.length;

    for (const node of nodes) {
      const neighbors = adjList.get(node.id) ?? [];
      const degreeCentrality = totalNodes > 1 ? neighbors.length / (totalNodes - 1) : 0;

      // Betweenness approximation: heuristic based on degree and weight
      let betweenness = degreeCentrality * 0.7;
      if (neighbors.length > 0) {
        const avgWeight = Array.from(neighbors)
          .map(n => edgeWeights.get(`${node.id}:${n}`) ?? 1)
          .reduce((a, b) => a + b, 0) / neighbors.length;
        betweenness += (avgWeight / 10) * 0.3;
      }
      betweenness = Math.min(1, betweenness);

      // Clustering coefficient: proportion of neighbors connected to each other
      let clusteringCoeff = 0;
      if (neighbors.length > 1) {
        let edges = 0;
        for (let i = 0; i < neighbors.length; i++) {
          for (let j = i + 1; j < neighbors.length; j++) {
            if (adjList.get(neighbors[i])?.includes(neighbors[j])) {
              edges++;
            }
          }
        }
        clusteringCoeff = edges / ((neighbors.length * (neighbors.length - 1)) / 2);
      }

      const risk = node.risk ?? 2;
      const riskWeighted = (degreeCentrality + betweenness) * risk;

      const criticality =
        riskWeighted >= 6 ? 'critical' :
        riskWeighted >= 4 ? 'high' :
        riskWeighted >= 2 ? 'medium' : 'low';

      results.push({
        nodeId: node.id,
        nodeType: node.path ? 'route' : 'domain',
        path: node.path,
        degreeCentrality: parseFloat(degreeCentrality.toFixed(3)),
        betweennesCentrality: parseFloat(betweenness.toFixed(3)),
        clusteringCoefficient: parseFloat(clusteringCoeff.toFixed(3)),
        riskWeighted: parseFloat(riskWeighted.toFixed(2)),
        criticality,
      });
    }

    return results;
  }

  private static identifyBottlenecks(
    centralities: NodeCentrality[],
    domainNodes: Map<string, string[]>,
    nodeMap: Map<string, any>,
  ): GraphTopologyReport['bottlenecks'] {
    const domainBottlenecks: Array<{ domain: string; routeCount: number; avgRiskScore: number }> = [];
    const routeBottlenecks: Array<{ path: string; betweenness: number; risk: number }> = [];

    // Domain bottlenecks: high-degree, high-risk clusters
    for (const [domain, routeIds] of domainNodes.entries()) {
      const routeData = routeIds.map(id => nodeMap.get(id)).filter(Boolean);
      const avgRisk = routeData.reduce((sum, r) => sum + (r.risk ?? 2), 0) / Math.max(1, routeData.length);
      if (routeData.length >= 3 && avgRisk >= 5) {
        domainBottlenecks.push({
          domain,
          routeCount: routeData.length,
          avgRiskScore: parseFloat(avgRisk.toFixed(2)),
        });
      }
    }

    // Route bottlenecks: high betweenness + high risk
    for (const cent of centralities.filter(c => c.nodeType === 'route')) {
      if (cent.betweennesCentrality >= 0.5 && cent.riskWeighted >= 5) {
        routeBottlenecks.push({
          path: cent.path ?? 'unknown',
          betweenness: cent.betweennesCentrality,
          risk: cent.riskWeighted,
        });
      }
    }

    return {
      domainBottlenecks: domainBottlenecks.sort((a, b) => b.avgRiskScore - a.avgRiskScore),
      routeBottlenecks: routeBottlenecks.sort((a, b) => b.betweenness - a.betweenness),
    };
  }

  private static analyzeFragmentation(
    nodes: any[],
    adjList: Map<string, string[]>,
    domainNodes: Map<string, string[]>,
  ): GraphTopologyReport['fragmentation'] {
    const isolatedDomains: string[] = [];
    const isolatedRoutes: string[] = [];
    const densityClusters: Array<{ domain: string; internalDensity: number }> = [];

    for (const [domain, routeIds] of domainNodes.entries()) {
      if (routeIds.length <= 1) {
        isolatedDomains.push(domain);
        if (routeIds.length === 1) {
          isolatedRoutes.push(routeIds[0]);
        }
        continue;
      }

      // Internal density: what % of possible edges within this domain exist?
      let internalEdges = 0;
      const maxPossible = (routeIds.length * (routeIds.length - 1)) / 2;
      for (let i = 0; i < routeIds.length; i++) {
        for (let j = i + 1; j < routeIds.length; j++) {
          if (adjList.get(routeIds[i])?.includes(routeIds[j])) {
            internalEdges++;
          }
        }
      }
      const density = maxPossible > 0 ? internalEdges / maxPossible : 0;
      if (density >= 0.3) {
        densityClusters.push({
          domain,
          internalDensity: parseFloat(density.toFixed(2)),
        });
      }
    }

    return {
      isolatedDomains,
      isolatedRoutes,
      densityClusters: densityClusters.sort((a, b) => b.internalDensity - a.internalDensity),
    };
  }

  private static countRiskLevels(nodes: any[]): Record<string, number> {
    const counts: Record<string, number> = {
      critical: 0,
      high: 0,
      medium: 0,
      low: 0,
      info: 0,
    };
    for (const node of nodes) {
      const risk = node.risk ?? 2;
      const level = risk >= 9 ? 'critical' : risk >= 7 ? 'high' : risk >= 5 ? 'medium' : 'low';
      counts[level]++;
    }
    return counts;
  }

  private static generateTopologyNotes(
    centralities: NodeCentrality[],
    bottlenecks: GraphTopologyReport['bottlenecks'],
    fragmentation: GraphTopologyReport['fragmentation'],
    totalNodes: number,
  ): string[] {
    const notes: string[] = [];

    const criticalNodes = centralities.filter(c => c.criticality === 'critical');
    if (criticalNodes.length > 0) {
      notes.push(
        `⚠️ ${criticalNodes.length} critical nodes: high centrality + risk exposure — redesign to reduce coupling or add redundancy`
      );
    }

    if (bottlenecks.domainBottlenecks.length > 0) {
      notes.push(
        `🔗 ${bottlenecks.domainBottlenecks.length} domain bottlenecks detected — consider microservice isolation or caching layers`
      );
    }

    if (bottlenecks.routeBottlenecks.length > 0) {
      notes.push(
        `⚙️ ${bottlenecks.routeBottlenecks.length} route bridges traffic between clusters — critical for uptime and hardening`
      );
    }

    if (fragmentation.isolatedDomains.length > 3) {
      notes.push(
        `📍 ${fragmentation.isolatedDomains.length} isolated domains — low coupling is good, but verify they're not orphaned`
      );
    }

    if (fragmentation.densityClusters.length > 0) {
      notes.push(
        `🎯 ${fragmentation.densityClusters[0].domain} is tightly clustered (density ${fragmentation.densityClusters[0].internalDensity}) — high internal consistency but potential single point of failure`
      );
    }

    return notes;
  }

  /**
   * Load mirror-node-graph.json from a run and analyze.
   */
  static async loadAndAnalyzeFromRunDirectory(
    runDir: string,
  ): Promise<GraphTopologyReport> {
    const graphPath = path.join(runDir, 'mirror-node-graph.json');
    const graph = JSON.parse(await fs.promises.readFile(graphPath, 'utf8'));
    return this.analyzeTopology(graph);
  }
}
