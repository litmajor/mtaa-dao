export type AssetBalance = {
  asset: string
  symbol: string
  balance: string
}

export type Position = {
  id: string
  asset: string
  size: number
  entryPrice?: number
}

export type PortfolioState = {
  address?: string
  balances: AssetBalance[]
  positions: Position[]
  updatedAt?: string
}

// Minimal PortfolioService: in-memory cache + fetch helper.
class PortfolioService {
  private cache: Record<string, PortfolioState | null> = {}

  async fetchPortfolio(address: string): Promise<PortfolioState> {
    // If cached and recent, return cached copy
    const cached = this.cache[address]
    if (cached) return cached

    try {
      // Attempt to call a backend endpoint if available
      const res = await fetch(`/api/v1/portfolio/${address}`)
      if (res.ok) {
        const data = await res.json()
        const state: PortfolioState = {
          address,
          balances: data.balances || [],
          positions: data.positions || [],
          updatedAt: new Date().toISOString()
        }
        this.cache[address] = state
        return state
      }
    } catch (e) {
      // ignore fetch errors and fallthrough to mock
    }

    // Fallback: return an empty portfolio
    const empty: PortfolioState = {
      address,
      balances: [],
      positions: [],
      updatedAt: new Date().toISOString()
    }
    this.cache[address] = empty
    return empty
  }

  getCached(address: string) {
    return this.cache[address] || null
  }

  clear(address?: string) {
    if (address) delete this.cache[address]
    else this.cache = {}
  }
}

export const portfolioService = new PortfolioService()
