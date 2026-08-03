export type BlockType = 'condition' | 'action' | 'logic' | 'risk' | 'execution' | 'ai' | 'vault' | 'crosschain';

export interface Port {
  id: string;
  name?: string;
  direction: 'in' | 'out';
}

export interface StrategyNodeBase {
  id: string;
  type: BlockType;
  label: string;
  icon: string;
  color: string;
  position: { x: number; y: number };
  ports: Port[];
}

export interface ConditionConfig {
  expression?: string; // e.g. "price > ma50"
}

export interface ActionConfig {
  actionType?: string; // e.g. 'buy' | 'sell' | 'swap'
  params?: Record<string, unknown>;
}

export interface RiskConfig {
  stopLossPct?: number;
  takeProfitPct?: number;
}

export interface ExecutionConfig {
  schedule?: string; // cron-like or trigger descriptor
}

export interface AiConfig {
  model?: string;
  prompt?: string;
  maxTokens?: number;
}

export interface VaultConfig {
  vaultAddress?: string;
  token?: string;
  amount?: number | string;
}

export interface CrosschainConfig {
  provider?: string;
  fromChain?: string;
  toChain?: string;
  token?: string;
  amount?: number | string;
}

export interface LogicConfig {
  [key: string]: unknown;
}

export interface ConditionNode extends StrategyNodeBase {
  type: 'condition';
  config: ConditionConfig;
}

export interface ActionNode extends StrategyNodeBase {
  type: 'action';
  config: ActionConfig;
}

export interface RiskNode extends StrategyNodeBase {
  type: 'risk';
  config: RiskConfig;
}

export interface ExecutionNode extends StrategyNodeBase {
  type: 'execution';
  config: ExecutionConfig;
}

export interface AiNode extends StrategyNodeBase {
  type: 'ai';
  config: AiConfig;
}

export interface VaultNode extends StrategyNodeBase {
  type: 'vault';
  config: VaultConfig;
}

export interface CrosschainNode extends StrategyNodeBase {
  type: 'crosschain';
  config: CrosschainConfig;
}

export interface LogicNode extends StrategyNodeBase {
  type: 'logic';
  config: LogicConfig;
}

export type StrategyNode =
  | ConditionNode
  | ActionNode
  | RiskNode
  | ExecutionNode
  | LogicNode
  | AiNode
  | VaultNode
  | CrosschainNode;
