import { StrategyNode } from '../models/StrategyNode';

// Each compiler returns a small compiled fragment for the node that the overall
// `compileGraph` function can incorporate. These are simple and intentionally
// minimal now; later the IR layer will normalize them.

export function compileAiNode(node: StrategyNode) {
  const cfg = (node as any).config || {};
  return {
    id: node.id,
    type: 'ai',
    model: cfg.model || 'gpt-4',
    prompt: cfg.prompt || '',
    maxTokens: cfg.maxTokens || 256,
  };
}

export function compileVaultNode(node: StrategyNode) {
  const cfg = (node as any).config || {};
  return {
    id: node.id,
    type: 'vault',
    vaultAddress: cfg.vaultAddress,
    token: cfg.token,
    amount: cfg.amount,
  };
}

export function compileCrosschainNode(node: StrategyNode) {
  const cfg = (node as any).config || {};
  return {
    id: node.id,
    type: 'crosschain',
    provider: cfg.provider,
    fromChain: cfg.fromChain,
    toChain: cfg.toChain,
    token: cfg.token,
    amount: cfg.amount,
  };
}
