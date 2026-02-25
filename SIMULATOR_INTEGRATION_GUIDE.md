# Simulator Integration Quick Start Guide

## Overview

The simulation system provides 23 comprehensive simulators for previewing actions before execution. This guide shows how to integrate simulators into existing components.

---

## Quick Integration Steps

### 1. Import Simulators

```typescript
// Option A: Import specific simulators
import { 
  SpotTradeSimulator, 
  MarginTradeSimulator,
  TradeSimulator 
} from '@/server/services/tradingDexSimulator';

// Option B: Use simulator registry for dynamic instantiation
import { getSimulator, listAvailableSimulators } from '@/server/services/simulatorIndex';

const simulator = getSimulator('SPOT_TRADE');
const allSimulators = listAvailableSimulators();
```

### 2. Run Simulation

```typescript
const simulator = new SpotTradeSimulator();

const result = await simulator.simulate({
  userId: currentUser.id,
  side: 'BUY',
  symbol: 'BTC/USDT',
  quantity: 0.5,
  currentPrice: 45000,
  volatility: 2.5, // Optional, defaults provided
});

// result: SimulationResult
console.log({
  status: result.status,           // SUCCESS | WARNING | ERROR
  riskLevel: result.riskLevel,     // LOW | MEDIUM | HIGH | CRITICAL
  riskFactors: result.riskFactors, // ['high-slippage', 'high-volatility']
  warnings: result.warnings,        // Non-blocking warnings
  delta: result.delta,              // State changes
});
```

---

## Integration Examples by Component

### Trading Dashboard (TradingDashboard.tsx)

```tsx
import { SpotTradeSimulator, MarginTradeSimulator, PerpetualsFuturesSimulator } from '@/server/services/tradingDexSimulator';
import { SimulationResult } from '@/server/services/simulationFramework';

export default function TradingDashboard() {
  const [simulationResult, setSimulationResult] = useState<SimulationResult | null>(null);
  const [showSimulationModal, setShowSimulationModal] = useState(false);

  const previewSpotTrade = async (orderData: any) => {
    try {
      const simulator = new SpotTradeSimulator();
      const result = await simulator.simulate({
        userId: currentUser.id,
        side: orderData.side,
        symbol: orderData.symbol,
        quantity: orderData.quantity,
        currentPrice: orderData.price,
        volatility: orderData.volatility,
      });
      
      setSimulationResult(result);
      setShowSimulationModal(true);
    } catch (error) {
      console.error('Simulation failed:', error);
    }
  };

  return (
    <div>
      {/* Order formation */}
      <QuickOrderPanel 
        onSimulateClick={previewSpotTrade}
      />
      
      {/* Simulation results modal */}
      {simulationResult && (
        <SimulationResultModal
          result={simulationResult}
          onConfirm={handleExecuteOrder}
          onCancel={() => setShowSimulationModal(false)}
        />
      )}
    </div>
  );
}
```

### DAO Treasury Management

```tsx
import { TreasuryRebalanceSimulator } from '@/server/services/daoTreasurySimulator';

export default function TreasuryRebalance() {
  const previewRebalance = async () => {
    const simulator = new TreasuryRebalanceSimulator();
    
    const result = await simulator.simulate({
      daoId: dao.id,
      currentAllocations: {
        'BTC': 30,
        'ETH': 40,
        'USDC': 30,
      },
      targetAllocations: {
        'BTC': 50,
        'ETH': 30,
        'USDC': 20,
      },
      treasuryValue: dao.treasuryValue,
      volatilities: {
        'BTC': 35,
        'ETH': 40,
        'USDC': 5,
      },
      monteCarloSimulations: 10000, // Full Monte Carlo analysis
    });

    // Use Monte Carlo results
    console.log({
      projectedValue: result.afterState.projectedValue1Year,
      var95: result.simulationData.var95,
      confidence: result.simulationData.confidenceOfPositive,
      riskLevel: result.riskLevel,
    });

    setRebalanceSimulation(result);
  };

  return (
    <div>
      <button onClick={previewRebalance}>Preview Rebalance</button>
      {rebalanceSimulation && (
        <RebalancePreviewModal simulation={rebalanceSimulation} />
      )}
    </div>
  );
}
```

### Governance Proposals

```tsx
import { 
  CreateProposalSimulator,
  VoteOnProposalSimulator,
  ExecuteProposalSimulator 
} from '@/server/services/governanceSimulator';

export default function GovernanceProposal() {
  // Step 1: Analyze proposal before creation
  const analyzeProposal = async (proposalData: any) => {
    const simulator = new CreateProposalSimulator();
    
    const analysis = await simulator.simulate({
      daoId: dao.id,
      proposalType: proposalData.type, // 'treasury', 'governance', 'parameter', 'text'
      description: proposalData.description,
      executionActions: proposalData.actions,
    });

    console.log({
      complexity: analysis.simulationData.complexity,
      estimatedPassProbability: analysis.simulationData.estimatedPassProbability,
      creationCost: analysis.simulationData.creationCost,
    });
  };

  // Step 2: Forecast voting outcome
  const forecastVoting = async () => {
    const voteSimulator = new VoteOnProposalSimulator();
    
    const forecast = await voteSimulator.simulate({
      daoId: dao.id,
      proposalId: proposal.id,
      totalVotingPower: dao.totalVotingPower,
      timeElapsedDays: 3,
      sentimentScore: 0.6, // Community sentiment (-1 to 1)
      historicalTurnout: 0.30,
    });

    console.log({
      passes: forecast.afterState.passes,
      forPercentage: forecast.afterState.forPercentage,
      margin: forecast.afterState.margin,
      expectedTurnout: forecast.afterState.turnout,
    });
  };

  // Step 3: Simulate execution
  const forecastExecution = async () => {
    const execSimulator = new ExecuteProposalSimulator();
    
    const execution = await execSimulator.simulate({
      daoId: dao.id,
      proposalId: proposal.id,
      executionActions: proposal.actions,
      treasury: dao.treasuryValue,
    });

    console.log({
      allSuccessful: execution.afterState.proposalStatus === 'EXECUTED',
      executedActions: execution.afterState.executedActions,
      totalCost: execution.afterState.totalCost,
      riskLevel: execution.riskLevel,
    });
  };

  return (
    <div className="proposal-analysis">
      <button onClick={analyzeProposal}>Analyze Proposal</button>
      <button onClick={forecastVoting}>Forecast Vote</button>
      <button onClick={forecastExecution}>Preview Execution</button>
    </div>
  );
}
```

### Agent Deployment

```tsx
import { AgentDeploymentSimulator, MultiAgentDeploymentSimulator } from '@/server/services/agentDeploymentSimulator';

export default function AgentDeployment() {
  // Deploy single agent
  const deployAgent = async (agentConfig: any) => {
    const simulator = new AgentDeploymentSimulator();
    
    const deployment = await simulator.simulate({
      agentId: agentConfig.id,
      agentType: agentConfig.type, // 'trading', 'governance', 'liquidation', 'arbitrage'
      initialCapital: agentConfig.capital,
      backtestData: agentConfig.backtest, // Historical data
      riskParameters: agentConfig.riskParams,
      circuitBreakerThresholds: {
        maxDrawdown: 20, // percent
        maxDailyLoss: 5,
        maxConsecutiveLosses: 5,
      },
    });

    console.log({
      status: deployment.status,
      projectedReturn: deployment.simulationData.projectedPerformance.projectedReturn,
      failureProbability: deployment.simulationData.projectedPerformance.failureProbability,
      sharpeRatio: deployment.simulationData.backtestResults.sharpeRatio,
      circuitBreakers: deployment.simulationData.circuitBreakerAnalysis.breakers.length,
    });

    setDeploymentResult(deployment);
  };

  // Deploy multiple agents
  const deployMultiAgent = async (agents: any[]) => {
    const simulator = new MultiAgentDeploymentSimulator();
    
    const deployment = await simulator.simulate({
      deploymentId: `deploy-${Date.now()}`,
      agents,
      totalCapital: agents.reduce((sum, a) => sum + a.capital, 0),
      correlationThreshold: 0.7, // Flag correlations above 70%
    });

    console.log({
      agentCount: deployment.afterState.agentCount,
      totalCapital: deployment.afterState.totalCapital,
      projectedReturn: deployment.afterState.projectedCombinedReturn,
      correlationRisk: deployment.afterState.correlationRisk,
    });
  };

  return (
    <div className="agent-deployment">
      <button onClick={() => deployAgent(agentConfig)}>Review Agent</button>
      <button onClick={() => deployMultiAgent(agents)}>Deploy Multi-Agent</button>
    </div>
  );
}
```

---

## SimulationResult Structure

```typescript
interface SimulationResult {
  // Status
  status: SimulationStatus;           // SUCCESS | WARNING | ERROR
  depth: SimulationDepth;             // BASIC | INTERMEDIATE | ADVANCED
  timestamp: number;
  executionTimeMs: number;

  // State changes
  beforeState: Record<string, any>;   // Initial state
  afterState: Record<string, any>;    // Projected state
  delta: Record<string, any>;         // Changes

  // Risk assessment
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  riskFactors: string[];              // e.g., ['high-volatility', 'low-liquidity']
  warnings: string[];                 // Non-blocking issues
  errors: string[];                   // Blocking errors

  // Reversibility
  reversibilityWindow: {
    minGracePeriodHours: number;
    recommendedGracePeriodHours: number;
    maxGracePeriodDays: number;
  };

  // Output
  summary: string;                    // Human-readable description
  impactedEntities: Array<{           // Affected parties
    type: string;
    id: string;
    impact: string;
  }>;

  // Detailed data (varies by simulator)
  simulationData?: Record<string, any>;
}
```

---

## Usage Patterns

### Pattern 1: Simple Risk Check

```typescript
const simulator = new SpotTradeSimulator();
const result = await simulator.simulate(params);

if (result.riskLevel === 'CRITICAL') {
  showWarning(`Trade too risky: ${result.riskFactors.join(', ')}`);
  return;
}

executeOrder();
```

### Pattern 2: Detailed Analysis

```typescript
const simulator = new MarginTradeSimulator();
const result = await simulator.simulate(params);

const analysis = {
  canProceed: result.status === SimulationStatus.SUCCESS,
  risks: result.riskFactors,
  warnings: result.warnings,
  liquidationPrice: result.simulationData.liquidationPrice,
  dailyFundingCost: result.simulationData.fundingRateHourly * 24,
  marginRatio: result.simulationData.marginRatio,
};

return showDetailedModal(analysis);
```

### Pattern 3: Forecasting

```typescript
// Monte Carlo data for treasury
const treasurySimulator = new TreasuryRebalanceSimulator();
const result = await treasurySimulator.simulate({
  ...params,
  monteCarloSimulations: 10000,
});

const forecast = {
  expected: result.simulationData.projectedMean,
  confidence95: [
    result.simulationData.percentile5,
    result.simulationData.percentile95,
  ],
  var95: result.simulationData.var95,
};

return displayForecastChart(forecast);
```

---

## Error Handling

```typescript
const runSimulation = async (params: any) => {
  try {
    const simulator = new SpotTradeSimulator();
    const result = await simulator.simulate(params);

    if (result.status === SimulationStatus.ERROR) {
      showError(`Simulation failed: ${result.errors.join(', ')}`);
      return null;
    }

    if (result.status === SimulationStatus.WARNING) {
      showWarning(`Simulation has issues: ${result.warnings.join(', ')}`);
      // Can still proceed but with caution
    }

    return result;
  } catch (error) {
    showError(`Unexpected error: ${error.message}`);
    return null;
  }
};
```

---

## Performance Notes

### Execution Times
- **BASIC** (Payment): <100ms
- **INTERMEDIATE** (Trading): <200ms
- **ADVANCED without Monte Carlo** (Governance): <500ms
- **ADVANCED with Monte Carlo** (Treasury): <2000ms with 10,000 simulations

### Optimization Tips

```typescript
// 1. Reduce Monte Carlo simulations for faster results
await treasury.simulate({
  ...params,
  monteCarloSimulations: 1000, // Instead of 10000
});

// 2. Cache simulator instances
const simulatorCache = new Map();
function getOrCreateSimulator(type: string) {
  if (!simulatorCache.has(type)) {
    simulatorCache.set(type, getSimulator(type));
  }
  return simulatorCache.get(type);
}

// 3. Run simulations in parallel
const [spotResult, marginResult] = await Promise.all([
  spotSimulator.simulate(spotParams),
  marginSimulator.simulate(marginParams),
]);
```

---

## Common Integration Points

### 1. Order Forms
- Add "Preview" button that runs simulation before submit
- Show risk assessment in modal
- Block submission if CRITICAL risk detected

### 2. Dashboards
- Display simulation results in summary cards
- Show historical simulation data
- Alert on high-risk patterns

### 3. Audit Logs
- Log all simulations with parameters and results
- Track user decision making
- Audit trail for regulatory compliance

### 4. API Endpoints
```typescript
// POST /api/simulate/:simulatorType
{
  simulatorType: 'SPOT_TRADE',
  params: { ... }
}

// Response
{
  simulationId: 'sim-xxx',
  result: SimulationResult
}
```

---

## Debugging Tips

### Enable Logging
```typescript
const simulator = new SpotTradeSimulator();

// Add logging wrapper
const originalSimulate = simulator.simulate.bind(simulator);
simulator.simulate = async (params) => {
  console.log('Simulation input:', params);
  const result = await originalSimulate(params);
  console.log('Simulation output:', result);
  return result;
};
```

### Check Simulation Data
```typescript
result.simulationData // Contains action-specific metrics
result.delta          // Shows state changes
result.afterState     // Projected outcome
result.riskFactors    // Identified risks
```

---

## Next Steps

1. **Integrate into Trading Dashboard**: Add simulation preview to order forms
2. **Create Simulation Modals**: Show detailed risk analysis
3. **Build History Dashboard**: Display past simulations
4. **Setup API Routes**: Expose simulators via REST API
5. **Add Audit Logging**: Track all simulations

---

For questions or issues, refer to:
- **Code**: Check inline comments in simulator files
- **Tests**: See paymentFlowSimulator.test.ts for examples
- **Framework**: Review simulationFramework.ts for base patterns
