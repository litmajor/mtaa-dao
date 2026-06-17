import { useSyncExternalStore } from 'react'
import Decimal from 'decimal.js'
import { Transaction, SelectedAccount } from '../../../shared/types/wallet'

export type Vault = { id: string; currency?: string; balance?: string | number; type?: string; locked?: boolean; pending?: boolean }

/**
 * Parse an unknown value into a Decimal safely.
 * Accepts string | number | Decimal instances; returns Decimal(0) on invalid input.
 */
export function parseDecimal(v: unknown): Decimal {
  try {
    if (v == null) return new Decimal(0)
    if (v instanceof Decimal) return v
    if (typeof v === 'number' || typeof v === 'string') return new Decimal(v)
    // fallback: try toString()
    const s = (v as any)?.toString?.()
    if (typeof s === 'string') return new Decimal(s)
    return new Decimal(0)
  } catch (err) {
    return new Decimal(0)
  }
}

type SecurityState = 'UNBACKED' | 'AT_RISK' | 'SECURE' | 'UNKNOWN'

// SelectedAccount is imported from types/wallet

type ActiveAction = { type: string; status?: string; payload?: Record<string, unknown> } | null

type OperatingState = {
  vaults: Vault[]
  transactions: Transaction[]
  activeSurface: string | null
  activeAction: ActiveAction
  selectedAccountId?: string
  selectedAccount?: SelectedAccount | null
  displayUnit: string
  securityState: SecurityState
  onboardingState?: Record<string, unknown>
  // computed (string-ified decimals to preserve precision)
  total: string
  liquidity: string
  deployed: string
  pendingCount: number
  walletHealth: { liquidity: string; diversification: string; exposure: string }
  // selectors (populated at runtime)
  availableVaults?: Vault[]
  lockedVaults?: Vault[]
  pendingVaults?: Vault[]
  deployedVaults?: Vault[]
  availableTotal?: string
  lockedTotal?: string
  pendingTotal?: string
  deployedTotal?: string
  diversificationTarget?: number
}

const defaultState: OperatingState = {
  vaults: [],
  transactions: [],
  activeSurface: null,
  activeAction: null,
  selectedAccountId: undefined,
  selectedAccount: null,
  displayUnit: 'USD',
  securityState: 'UNBACKED',
  onboardingState: undefined,
  total: '0',
  liquidity: '0',
  deployed: '0',
  pendingCount: 0,
  walletHealth: { liquidity: 'WEAK', diversification: 'MEDIUM', exposure: 'LOW_RISK' }
}

type Listener = (s: OperatingState) => void

const store: { state: OperatingState; listeners: Set<Listener> } = {
  state: { ...defaultState },
  listeners: new Set()
}

// compute initial derived state
store.state = compute(store.state)

function notify() {
  // snapshot listeners to avoid mutation during iteration
  const items = Array.from(store.listeners)
  for (const l of items) {
    try {
      l(store.state)
    } catch (err) {
      // swallow to avoid breaking other listeners; send to console for observability
      // Replace with logging/observability in production
      // eslint-disable-next-line no-console
      console.error('listener errored', err)
    }
  }
}

function compute(nextState: OperatingState): OperatingState {
  try {

    const liquidityDec = nextState.vaults
      .filter(v => !v.type || v.type === 'personal' || v.type === 'token')
      .reduce((s, v) => s.plus(parseDecimal(v.balance)), new Decimal(0))

    const deployedDec = nextState.vaults
      .filter(v => v.type === 'deployed' || v.type === 'yield')
      .reduce((s, v) => s.plus(parseDecimal(v.balance)), new Decimal(0))

    const totalDec = nextState.vaults.reduce((s, v) => s.plus(parseDecimal(v.balance)), new Decimal(0))

    const escrowExposureDec = nextState.vaults
      .filter(v => v.type === 'escrow')
      .reduce((s, v) => s.plus(parseDecimal(v.balance)), new Decimal(0))

    const diversification = Math.min(1, (nextState.vaults.length || 1) / 10)
    const exposureRatio = totalDec.isZero() ? new Decimal(0) : escrowExposureDec.dividedBy(totalDec)

    const walletHealth = {
      liquidity: liquidityDec.gt(0) ? 'STRONG' : 'WEAK',
      diversification: diversification > 0.5 ? 'GOOD' : 'MEDIUM',
      exposure: exposureRatio.lt(0.2) ? 'LOW_RISK' : exposureRatio.lt(0.5) ? 'MEDIUM_RISK' : 'HIGH_RISK'
    }

    const availableVaults = nextState.vaults.filter(v => (v.type === 'personal' || !v.type || v.type === 'token') && !v.locked && !v.pending)
    const lockedVaults = nextState.vaults.filter(v => v.locked)
    const pendingVaults = nextState.vaults.filter(v => v.pending)
    const deployedVaults = nextState.vaults.filter(v => v.type === 'deployed' || v.type === 'yield')

    const availableTotal = availableVaults.reduce((s, v) => s.plus(parseDecimal(v.balance)), new Decimal(0))
    const lockedTotal = lockedVaults.reduce((s, v) => s.plus(parseDecimal(v.balance)), new Decimal(0))
    const pendingTotal = pendingVaults.reduce((s, v) => s.plus(parseDecimal(v.balance)), new Decimal(0))
    const deployedTotal = deployedVaults.reduce((s, v) => s.plus(parseDecimal(v.balance)), new Decimal(0))

    return {
      ...nextState,
      total: totalDec.toString(),
      liquidity: liquidityDec.toString(),
      deployed: deployedDec.toString(),
      pendingCount: nextState.transactions.filter(t => t.status === 'pending' || t.status === 'processing').length,
      walletHealth,
      availableVaults,
      lockedVaults,
      pendingVaults,
      deployedVaults,
      availableTotal: availableTotal.toString(),
      lockedTotal: lockedTotal.toString(),
      pendingTotal: pendingTotal.toString(),
      deployedTotal: deployedTotal.toString()
    }
  } catch (err) {
    // don't crash the app; log and return previous state shaped values
    // eslint-disable-next-line no-console
    console.error('compute failed', err)
    return {
      ...nextState,
      total: nextState.total || '0',
      liquidity: nextState.liquidity || '0',
      deployed: nextState.deployed || '0',
      pendingCount: nextState.pendingCount || 0,
      walletHealth: nextState.walletHealth || { liquidity: 'WEAK', diversification: 'MEDIUM', exposure: 'LOW_RISK' }
    }
  }
}

function setState(partial: Partial<OperatingState>) {
  const merged = { ...store.state, ...partial }
  const next = compute(merged)
  store.state = next
  notify()
}

function subscribe(listener: Listener) {
  store.listeners.add(listener)
  return () => store.listeners.delete(listener)
}

function getSnapshot() {
  return store.state
}

/**
 * Selector helper - returns only the selected slice and re-renders when it changes.
 */
export function useWalletOperatingSelector<T>(selector: (s: OperatingState) => T): T {
  return useSyncExternalStore(subscribe, () => selector(store.state), () => selector(store.state))
}

export function useWalletOperatingStore() {
  const snapshot = useSyncExternalStore(subscribe, getSnapshot, getSnapshot)

  return {
    ...snapshot,
    // actions
    setVaults: (v: Vault[]) => { setState({ vaults: v }); return Promise.resolve() },
    setTransactions: (t: Transaction[]) => { setState({ transactions: t }); return Promise.resolve() },
    setSelectedAccount: (a: SelectedAccount | null) => { setState({ selectedAccount: a }); return Promise.resolve() },
    setSelectedAccountId: (id?: string) => { setState({ selectedAccountId: id }); return Promise.resolve() },
    setActiveSurface: (s: string | null) => { setState({ activeSurface: s }); return Promise.resolve() },
    openAction: (act: ActiveAction) => { setState({ activeAction: act }); return Promise.resolve() },
    closeAction: () => { setState({ activeAction: null }); return Promise.resolve() },
    setDisplayUnit: (u: string) => { setState({ displayUnit: u }); return Promise.resolve() },
    setSecurityState: (s: SecurityState) => { setState({ securityState: s }); return Promise.resolve() },
    setOnboardingState: (o: Record<string, unknown> | undefined) => { setState({ onboardingState: o }); return Promise.resolve() },
    setDiversificationTarget: (n: number) => { setState({ diversificationTarget: n }); return Promise.resolve() }
  }
}

export default useWalletOperatingStore
