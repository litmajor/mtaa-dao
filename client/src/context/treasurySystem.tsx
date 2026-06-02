import React, { createContext, useContext, useReducer } from 'react';

export type TreasuryWorkspace = 'overview' | 'coordination' | 'execution' | 'security' | 'governance' | 'recovery';

export interface MultisigWallet {
  id: string;
  address: string;
  name: string;
  owners: string[];
  threshold: number;
  balance?: string;
  transactionCount?: number;
  createdAt?: string;
}

export type TransactionPhase =
  | 'draft'
  | 'simulated'
  | 'awaiting_signatures'
  | 'threshold_reached'
  | 'queued'
  | 'executing'
  | 'confirmed'
  | 'rejected'
  | 'archived';

export interface MultisigTransaction {
  id: string;
  multisigAddress: string;
  destination: string;
  value: string;
  data?: string;
  phase: TransactionPhase;
  createdAt: string;
  approvals: string[]; // signer addresses
  required: number;
}

export interface Signer {
  address: string;
  status: 'online' | 'offline' | 'unknown';
  participationRate: number;
  trustScore: number;
  lastSeen?: string;
  signingLatency?: number;
}

export interface TreasuryState {
  workspace: TreasuryWorkspace;
  multisigWallets: MultisigWallet[];
  executionQueue: MultisigTransaction[];
  signers: Signer[];
  treasuryHealth: number; // 0..100
}

const initialState: TreasuryState = {
  workspace: 'overview',
  multisigWallets: [],
  executionQueue: [],
  signers: [],
  treasuryHealth: 100,
};

type Action =
  | { type: 'addWallet'; wallet: MultisigWallet }
  | { type: 'setWorkspace'; workspace: TreasuryWorkspace }
  | { type: 'enqueueTransaction'; tx: MultisigTransaction }
  | { type: 'updateTransactionPhase'; id: string; phase: TransactionPhase }
  | { type: 'updateSigner'; signer: Signer };

function reducer(state: TreasuryState, action: Action): TreasuryState {
  switch (action.type) {
    case 'addWallet':
      return { ...state, multisigWallets: [...state.multisigWallets, action.wallet] };
    case 'setWorkspace':
      return { ...state, workspace: action.workspace };
    case 'enqueueTransaction':
      return { ...state, executionQueue: [action.tx, ...state.executionQueue] };
    case 'updateTransactionPhase':
      return {
        ...state,
        executionQueue: state.executionQueue.map(tx => tx.id === action.id ? { ...tx, phase: action.phase } : tx),
      };
    case 'updateSigner':
      return {
        ...state,
        signers: state.signers.map(s => s.address === action.signer.address ? action.signer : s),
      };
    default:
      return state;
  }
}

export interface TreasurySystemContextValue {
  state: TreasuryState;
  actions: {
    addWallet: (w: MultisigWallet) => void;
    setWorkspace: (ws: TreasuryWorkspace) => void;
    enqueueTransaction: (tx: MultisigTransaction) => void;
    updateTransactionPhase: (id: string, phase: TransactionPhase) => void;
    updateSigner: (s: Signer) => void;
  };
}

const TreasurySystemContext = createContext<TreasurySystemContextValue | undefined>(undefined);

export const TreasurySystemProvider: React.FC<{ initialState?: Partial<TreasuryState> }> = ({ children, initialState }) => {
  const [state, dispatch] = useReducer(reducer, { ...initialState as any, ...initialState ? initialState as TreasuryState : {}, ...initialState ? {} : {}, ...initialState ? {} : {}, ...initialState ? {} : {}, ...initialState ? {} : {}, ...initialState ? {} : {}, ...initialState ? {} : {}, initialState: undefined } as unknown as TreasuryState);

  // The above line tries to merge partials; keep simple override if provided

  // Fallback: if initialState provided, merge; else use initialState const
  const _state = (initialState ? { ...initialState as TreasuryState, ...initialState } : initialState) as unknown as TreasuryState;

  // But to avoid complexity, use reducer initial state
  // Actions
  const actions = {
    addWallet: (w: MultisigWallet) => dispatch({ type: 'addWallet', wallet: w }),
    setWorkspace: (ws: TreasuryWorkspace) => dispatch({ type: 'setWorkspace', workspace: ws }),
    enqueueTransaction: (tx: MultisigTransaction) => dispatch({ type: 'enqueueTransaction', tx }),
    updateTransactionPhase: (id: string, phase: TransactionPhase) => dispatch({ type: 'updateTransactionPhase', id, phase }),
    updateSigner: (s: Signer) => dispatch({ type: 'updateSigner', signer: s }),
  };

  return (
    <TreasurySystemContext.Provider value={{ state, actions }}>
      {children}
    </TreasurySystemContext.Provider>
  );
};

export function useTreasurySystem(): TreasurySystemContextValue {
  const ctx = useContext(TreasurySystemContext);
  if (!ctx) {
    // graceful fallback returning local handlers to avoid runtime crash
    const noop = () => {};
    return {
      state: initialState,
      actions: {
        addWallet: noop,
        setWorkspace: noop,
        enqueueTransaction: noop,
        updateTransactionPhase: noop,
        updateSigner: noop,
      },
    };
  }
  return ctx;
}
