import type { ComponentType } from 'react';
import ConditionInspector from '../components/trading/inspectors/ConditionInspector';
import ActionInspector from '../components/trading/inspectors/ActionInspector';
import RiskInspector from '../components/trading/inspectors/RiskInspector';
import ExecutionInspector from '../components/trading/inspectors/ExecutionInspector';
import AiInspector from '../components/trading/inspectors/AiInspector';
import VaultInspector from '../components/trading/inspectors/VaultInspector';
import CrosschainInspector from '../components/trading/inspectors/CrosschainInspector';
import { validateAiNode, validateVaultNode, validateCrosschainNode } from '../engine/node-validators';
import { compileAiNode, compileVaultNode, compileCrosschainNode } from '../engine/node-compilers';
import type {
  StrategyNode,
  ConditionNode,
  ActionNode,
  RiskNode,
  ExecutionNode,
  AiNode,
  VaultNode,
  CrosschainNode,
} from '../models/StrategyNode';
import type { ValidationIssue } from '../engine/strategy-validator';
import type { CompiledNode } from '../engine/strategy-compiler';

type InspectorProps<T extends StrategyNode> = {
  node: T;
  onChange: (patch: any) => void;
};

export type NodeValidator<T extends StrategyNode = StrategyNode> = (node: T) => ValidationIssue[];
export type NodeCompiler<T extends StrategyNode = StrategyNode> = (node: T) => CompiledNode;

export interface NodeRegistryEntry<T extends StrategyNode = StrategyNode> {
  inspector: ComponentType<InspectorProps<T>>;
  icon?: string;
  color?: string;
  validator?: NodeValidator<T>;
  compiler?: NodeCompiler<T>;
}

type NodeRegistryMap = Record<string, NodeRegistryEntry<any>>;

const NodeRegistry: NodeRegistryMap = {
  condition: {
    inspector: ConditionInspector,
    icon: '🔎',
    color: 'blue',
  },
  action: {
    inspector: ActionInspector,
    icon: '⚡',
    color: 'green',
  },
  risk: {
    inspector: RiskInspector,
    icon: '🛡️',
    color: 'red',
  },
  execution: {
    inspector: ExecutionInspector,
    icon: '▶️',
    color: 'purple',
  },
  ai: {
    inspector: AiInspector,
    icon: '🤖',
    color: 'indigo',
    validator: validateAiNode,
    compiler: compileAiNode,
  },
  vault: {
    inspector: VaultInspector,
    icon: '🏦',
    color: 'emerald',
    validator: validateVaultNode,
    compiler: compileVaultNode,
  },
  crosschain: {
    inspector: CrosschainInspector,
    icon: '🔗',
    color: 'teal',
    validator: validateCrosschainNode,
    compiler: compileCrosschainNode,
  },
};

export default NodeRegistry;
