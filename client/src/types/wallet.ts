import Decimal from 'decimal.js'

export interface Transaction {
  id?: string
  type?: string
  amount?: string | number
  value?: string
  asset?: string
  description?: string
  memo?: string
  time?: string
  timeAgo?: string
  from?: string
  to?: string
  direction?: 'in' | 'out'
  status?: string
}

export type SelectedAccount = { id?: string; address?: string; chainId?: number; label?: string } | null

// typed helper signature for parsing values into Decimal
export function parseDecimalSignature(v: unknown): Decimal {
  // This is a type-only helper placeholder. Use the implementation in the store or import the concrete helper.
  return new Decimal(0)
}

export default {}
