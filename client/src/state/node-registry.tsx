import ConditionInspector from '../components/trading/inspectors/ConditionInspector';
import ActionInspector from '../components/trading/inspectors/ActionInspector';
import RiskInspector from '../components/trading/inspectors/RiskInspector';
import ExecutionInspector from '../components/trading/inspectors/ExecutionInspector';
import AiInspector from '../components/trading/inspectors/AiInspector';
import VaultInspector from '../components/trading/inspectors/VaultInspector';
import CrosschainInspector from '../components/trading/inspectors/CrosschainInspector';
import { validateAiNode, validateVaultNode, validateCrosschainNode } from '../engine/node-validators';
import { compileAiNode, compileVaultNode, compileCrosschainNode } from '../engine/node-compilers';

export interface NodeRegistryEntry {
  inspector: any;
  icon?: string;
  color?: string;
  validator?: any;
  compiler?: any;
}

const NodeRegistry: Record<string, NodeRegistryEntry> = {
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
