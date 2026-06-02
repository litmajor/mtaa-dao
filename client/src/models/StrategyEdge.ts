export interface StrategyEdge {
  id: string;
  // legacy fields for compatibility — optional now
  source?: string;
  target?: string;

  sourceNodeId: string;
  sourcePortId?: string;

  targetNodeId: string;
  targetPortId?: string;

  label?: string;
}

export default StrategyEdge;
