import type { AiNode, VaultNode, CrosschainNode } from '../models/StrategyNode';

// Each compiler returns a small compiled fragment for the node that the overall
// `compileGraph` function can incorporate. These are simple and intentionally
// minimal now; later the IR layer will normalize them.

export function compileAiNode(node: AiNode) {
  const { model = 'gpt-4', prompt = '', maxTokens = 256 } = node.config;

  return {
    id: node.id,
    type: 'ai',
    config: node.config,
    model,
    prompt,
    maxTokens,
  };
}

export function compileVaultNode(node: VaultNode) {
  const { vaultAddress, token, amount } = node.config;

  return {
    id: node.id,
    type: 'vault',
    config: node.config,
    vaultAddress,
    token,
    amount,
  };
}

export function compileCrosschainNode(node: CrosschainNode) {
  const { provider, fromChain, toChain, token, amount } = node.config;

  return {
    id: node.id,
    type: 'crosschain',
    config: node.config,
    provider,
    fromChain,
    toChain,
    token,
    amount,
  };
}
