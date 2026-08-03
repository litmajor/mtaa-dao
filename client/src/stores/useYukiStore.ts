import { create } from 'zustand';

export type WsConnectionState = 'idle' | 'connecting' | 'connected' | 'reconnecting' | 'disconnected';

export interface YukiAlert {
  id: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  title: string;
  message: string;
  timestamp: string;
  source?: string;
  meta?: Record<string, any>;
}

interface YukiStoreState {
  activePersona: string | null;
  wsConnected: boolean;
  wsConnectionState: WsConnectionState;
  reconnectAttempts: number;
  portfolioTotals: Record<string, any> | null;
  positions: any[];
  openOrders: any[];
  connectedExchanges: any[];
  strategies: any[];
  marketOverview: any | null;
  currentSentiment: any | null;
  activeSignals: any[];
  riskSettings: any | null;
  stakingPositions: any[];
  rebalancingStatus: any | null;
  algoStatus: any | null;
  trades: any[];
  pendingCrossChainTxs: any[];
  alerts: YukiAlert[];
  preFilledTrade: any;
  setActivePersona: (persona: string | null) => void;
  setWsConnected: (connected: boolean) => void;
  setWsConnectionState: (state: WsConnectionState) => void;
  setReconnectAttempts: (attempts: number) => void;
  setPortfolioTotals: (payload: any) => void;
  setPositions: (payload: any) => void;
  upsertPosition: (payload: any) => void;
  setOpenOrders: (payload: any) => void;
  upsertOrder: (payload: any) => void;
  setConnectedExchanges: (payload: any) => void;
  setStrategies: (payload: any) => void;
  setMarketOverview: (payload: any) => void;
  upsertMarketSnapshot: (payload: any) => void;
  setCurrentSentiment: (payload: any) => void;
  setActiveSignals: (payload: any) => void;
  updateRiskSettings: (payload: any) => void;
  setStakingPositions: (payload: any) => void;
  setRebalancingStatus: (payload: any) => void;
  setAlgoStatus: (payload: any) => void;
  addTrade: (payload: any) => void;
  addPendingCrossChainTx: (tx: any) => void;
  updatePendingCrossChainTx: (id: string, tx: any) => void;
  removePendingCrossChainTx: (id: string) => void;
  addAlert: (alert: YukiAlert) => void;
  setPreFilledTrade: (trade: any) => void;
}

export const useYukiStore = create<YukiStoreState>((set, get) => ({
  activePersona: null,
  wsConnected: false,
  wsConnectionState: 'idle',
  reconnectAttempts: 0,
  portfolioTotals: null,
  positions: [],
  openOrders: [],
  connectedExchanges: [],
  strategies: [],
  marketOverview: null,
  currentSentiment: null,
  activeSignals: [],
  riskSettings: null,
  stakingPositions: [],
  rebalancingStatus: null,
  algoStatus: null,
  trades: [],
  pendingCrossChainTxs: [],
  alerts: [],
  preFilledTrade: null,
  setActivePersona: (persona) => set({ activePersona: persona }),
  setWsConnected: (connected) => set({ wsConnected: connected }),
  setWsConnectionState: (state) => set({ wsConnectionState: state }),
  setReconnectAttempts: (attempts) => set({ reconnectAttempts: attempts }),
  setPortfolioTotals: (payload) => set({ portfolioTotals: payload }),
  setPositions: (payload) => set({ positions: Array.isArray(payload) ? payload : [] }),
  upsertPosition: (payload) => {
    const next = [...get().positions];
    const idx = next.findIndex((item: any) => item.id === payload.id);
    if (idx >= 0) next[idx] = payload; else next.push(payload);
    set({ positions: next });
  },
  setOpenOrders: (payload) => set({ openOrders: Array.isArray(payload) ? payload : [] }),
  upsertOrder: (payload) => {
    const next = [...get().openOrders];
    const idx = next.findIndex((item: any) => item.id === payload.id);
    if (idx >= 0) next[idx] = payload; else next.push(payload);
    set({ openOrders: next });
  },
  setConnectedExchanges: (payload) => set({ connectedExchanges: Array.isArray(payload) ? payload : [] }),
  setStrategies: (payload) => set({ strategies: Array.isArray(payload) ? payload : [] }),
  setMarketOverview: (payload) => set({ marketOverview: payload }),
  upsertMarketSnapshot: (payload) => set({ marketOverview: payload }),
  setCurrentSentiment: (payload) => set({ currentSentiment: payload }),
  setActiveSignals: (payload) => set({ activeSignals: Array.isArray(payload) ? payload : [] }),
  updateRiskSettings: (payload) => set({ riskSettings: payload }),
  setStakingPositions: (payload) => set({ stakingPositions: Array.isArray(payload) ? payload : [] }),
  setRebalancingStatus: (payload) => set({ rebalancingStatus: payload }),
  setAlgoStatus: (payload) => set({ algoStatus: payload }),
  addTrade: (payload) => set((state) => ({ trades: [payload, ...state.trades].slice(0, 100) })),
  addPendingCrossChainTx: (tx) => set((state) => ({ pendingCrossChainTxs: [tx, ...state.pendingCrossChainTxs] })),
  updatePendingCrossChainTx: (id, tx) => set((state) => ({
    pendingCrossChainTxs: state.pendingCrossChainTxs.map((item: any) => item.id === id ? tx : item),
  })),
  removePendingCrossChainTx: (id) => set((state) => ({
    pendingCrossChainTxs: state.pendingCrossChainTxs.filter((item: any) => item.id !== id),
  })),
  addAlert: (alert) => set((state) => ({ alerts: [alert, ...state.alerts].slice(0, 50) })),
  setPreFilledTrade: (trade) => set({ preFilledTrade: trade }),
}));
