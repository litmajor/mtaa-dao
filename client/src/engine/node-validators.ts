import { ValidationIssue, ValidationSeverity } from './strategy-validator';
import { StrategyNode } from '../models/StrategyNode';

export function validateAiNode(node: StrategyNode): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const cfg = (node as any).config || {};
  if (!cfg.model) {
    issues.push({ severity: ValidationSeverity.ERROR, message: 'AI node missing model', nodeId: node.id });
  }
  if (!cfg.prompt) {
    issues.push({ severity: ValidationSeverity.WARNING, message: 'AI node has no prompt configured', nodeId: node.id });
  }
  return issues;
}

export function validateVaultNode(node: StrategyNode): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const cfg = (node as any).config || {};
  if (!cfg.vaultAddress) {
    issues.push({ severity: ValidationSeverity.ERROR, message: 'Vault node missing vaultAddress', nodeId: node.id });
  }
  if (!cfg.token) {
    issues.push({ severity: ValidationSeverity.WARNING, message: 'Vault node has no token configured', nodeId: node.id });
  }
  return issues;
}

export function validateCrosschainNode(node: StrategyNode): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const cfg = (node as any).config || {};
  if (!cfg.provider) {
    issues.push({ severity: ValidationSeverity.ERROR, message: 'Crosschain node missing provider', nodeId: node.id });
  }
  if (!cfg.fromChain || !cfg.toChain) {
    issues.push({ severity: ValidationSeverity.ERROR, message: 'Crosschain node must specify fromChain and toChain', nodeId: node.id });
  }
  return issues;
}
