import { ethers } from "ethers";

interface RpcEndpoint {
  name: string;
  httpUrl: string;
}

interface RpcProviderOptions {
  primary: RpcEndpoint;
  fallback?: RpcEndpoint;
  /** How long to stay on fallback after tripping, before trying primary again. */
  cooldownMs?: number;
  /** Called whenever a failover happens — wire this into logging/alerts. */
  onFailover?: (from: string, to: string, reason: string) => void;
  /** Called when failover resets back to primary after cooldown. */
  onRecover?: (provider: string) => void;
  /** Optional factory for tests or alternate provider implementations. */
  createProvider?: (url: string) => ethers.JsonRpcProvider;
}

/**
 * Wraps a primary + fallback JSON-RPC provider pair with explicit failover
 * on rate-limit (429) and outage errors only. Deliberately does NOT retry
 * on application-level errors (bad params, contract reverts) — those will
 * fail identically on the fallback and retrying just hides the real bug.
 *
 * Deliberately NOT using ethers' FallbackProvider: that does quorum-based
 * multi-provider querying by default, which spends CU on both providers
 * on every call. This wrapper only pays for the fallback when the primary
 * actually fails.
 */
export class ResilientRpcProvider {
  private primaryProvider: ethers.JsonRpcProvider;
  private fallbackProvider?: ethers.JsonRpcProvider;
  private usingFallback = false;
  private fallbackUntil = 0;
  private opts: Required<Pick<RpcProviderOptions, "cooldownMs">> & RpcProviderOptions;

  constructor(opts: RpcProviderOptions) {
    this.opts = { cooldownMs: 60_000, ...opts };
    this.primaryProvider = this.createProvider(opts.primary.httpUrl);
    this.fallbackProvider = opts.fallback?.httpUrl ? this.createProvider(opts.fallback.httpUrl) : undefined;
  }

  private createProvider(url: string): ethers.JsonRpcProvider {
    return this.opts.createProvider ? this.opts.createProvider(url) : new ethers.JsonRpcProvider(url);
  }

  /**
   * Distinguishes "the provider failed me" from "my request was bad."
   * Only the former should trigger failover — the latter will fail the
   * same way on any provider and silently retrying it just delays a real
   * error surfacing.
   */
  private isProviderFailure(err: any): boolean {
    const status = err?.info?.responseStatus ?? err?.status ?? err?.error?.code;
    if (status === 429 || status === "429") return true;

    const code = err?.code ?? err?.error?.code;
    if (code === "SERVER_ERROR" || code === "TIMEOUT" || code === "NETWORK_ERROR") return true;

    const combined = [
      err?.message,
      err?.cause?.message,
      err?.error?.message,
      err?.info?.error,
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();

    return /rate limit|too many requests|429|failed to detect network|cannot start up|fetch failed|socket hang up|econnreset|econnrefused|enotfound|etimedout|timed out|temporarily unavailable|service unavailable|overloaded|bad gateway|gateway time-out|connection reset|connection closed/i.test(combined);
  }

  private activeProvider(): { provider: ethers.JsonRpcProvider; label: "primary" | "fallback" } {
    if (this.usingFallback) {
      if (Date.now() < this.fallbackUntil) {
        if (!this.fallbackProvider) {
          return { provider: this.primaryProvider, label: "primary" };
        }
        return { provider: this.fallbackProvider, label: "fallback" };
      }
      // cooldown expired — try primary again, but don't declare recovery
      // until a call actually succeeds on it (see call() below).
      return { provider: this.primaryProvider, label: "primary" };
    }
    return { provider: this.primaryProvider, label: "primary" };
  }

  private tripToFallback(reason: string) {
    const wasAlreadyOnFallback = this.usingFallback;
    this.usingFallback = true;
    this.fallbackUntil = Date.now() + this.opts.cooldownMs;
    if (!wasAlreadyOnFallback && this.opts.fallback) {
      this.opts.onFailover?.(this.opts.primary.name, this.opts.fallback.name, reason);
    }
  }

  private markRecovered() {
    if (this.usingFallback) {
      this.usingFallback = false;
      this.opts.onRecover?.(this.opts.primary.name);
    }
  }

  /**
   * Run any ethers provider call through the resilient wrapper.
   * Usage: await rpc.call(p => p.getBalance(address))
   */
  async call<T>(fn: (provider: ethers.JsonRpcProvider) => Promise<T>): Promise<T> {
    const { provider, label } = this.activeProvider();

    try {
      const result = await fn(provider);
      if (label === "primary") this.markRecovered();
      return result;
    } catch (err) {
      if (!this.isProviderFailure(err)) {
        // Real application error — don't mask it by retrying elsewhere.
        throw err;
      }

      if (label === "primary") {
        if (!this.fallbackProvider) {
          throw err;
        }
        this.tripToFallback((err as Error).message ?? "primary provider failure");
        // One retry on fallback for this call — if that also fails, surface it.
        return await fn(this.fallbackProvider);
      }

      // Already on fallback and it failed too — nothing left to fall back to.
      throw err;
    }
  }

  /**
   * Run a signer-bound operation against the currently active endpoint.
   * Reconnecting a Wallet to the active provider is required for writes;
   * keeping a signer permanently bound to the primary would bypass failover.
   */
  async callWithSigner<T>(
    signer: ethers.Signer,
    fn: (signer: ethers.Signer) => Promise<T>
  ): Promise<T> {
    return this.call((provider) => fn(signer.connect(provider)));
  }

  /** Escape hatch if you need the raw provider for something the wrapper doesn't cover (e.g. WebSocket subscriptions — see note below). */
  getRawProvider(): ethers.JsonRpcProvider {
    return this.activeProvider().provider;
  }
}

/*
Usage:

const rpc = new ResilientRpcProvider({
  primary: { name: "alchemy", httpUrl: process.env.ALCHEMY_CELO_URL! },
  fallback: { name: "quicknode", httpUrl: process.env.QUICKNODE_CELO_URL! },
  cooldownMs: 60_000,
  onFailover: (from, to, reason) => {
    console.warn(`[RPC] Failover ${from} -> ${to}: ${reason}`);
    // wire into your alerting/metrics here
  },
  onRecover: (provider) => {
    console.info(`[RPC] Recovered to ${provider}`);
  },
});

const balance = await rpc.call((p) => p.getBalance(userAddress));

NOTE: This wrapper covers HTTP JSON-RPC calls only. WebSocket subscriptions
(for the scanner/real-time gateway) have different reconnect semantics —
a dropped WS connection needs its own reconnect-and-resubscribe logic,
not this failover pattern. That's a separate piece to build.
*/