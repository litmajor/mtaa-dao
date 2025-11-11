
/**
 * Analyzer Agent Type Definitions
 */

export enum ThreatLevel {
  MINIMAL = 'minimal',
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical'
}

export enum AnalysisType {
  TRANSACTION = 'transaction',
  PROPOSAL = 'proposal',
  VAULT = 'vault',
  USER_BEHAVIOR = 'user_behavior',
  PATTERN = 'pattern'
}

export interface ThreatPattern {
  id: string;
  name: string;
  description: string;
  severity: ThreatLevel;
  indicators: string[];
  confidence: number;
}

export interface AnalysisResult {
  id: string;
  type: AnalysisType;
  timestamp: Date;
  threatLevel: ThreatLevel;
  confidence: number;
  findings: Finding[];
  recommendations: string[];
  metadata: Record<string, any>;
}

export interface Finding {
  type: string;
  severity: ThreatLevel;
  description: string;
  evidence: any[];
  confidence: number;
}

export interface AnomalyDetectionResult {
  isAnomaly: boolean;
  score: number;
  reasons: string[];
  context: Record<string, any>;
}

export interface PatternMatch {
  pattern: ThreatPattern;
  confidence: number;
  matches: any[];
}
