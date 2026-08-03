import { ethers } from "ethers";

interface WsEndpoint {
  name: string;
  wsUrl: string;
}

interface SubscriptionEntry {
  id: string;
  event: ethers.EventFilter | string | Array<any>;
  listener: (...args: any[]) => void;
}

interface ResilientWsOptions {
  primary: WsEndpoint;
  fallback: WsEndpoint;
  /** Reconnect attempts against the current endpoint before failing over. */
  maxReconnectAttempts?: number;
  baseBackoffMs?: number;
  maxBackoffMs?: number;
  onFailover?: (from: string, to: string, reason: string) => void;
  onReconnectAttempt?: (endpoint: string, attempt: number) => void;
  onSubscriptionsRestored?: (count: number) => void;
  /**
   * Called after a reconnect/failover with the block range that was missed
   * while disconnected. YOU are responsible for backfilling this range via
   * getLogs (or your own event-processing pipeline) — this wrapper only
   * detects the gap, it does not know your event schemas well enough to
   * backfill for you. Skipping this means missed deposits/votes/events
   * during any disconnect window, silently.
   */
  onGapDetected?: (fromBlock: number, toBlock: number) => Promise<void> | void;
}

/**
 * WebSocket counterpart to ResilientRpcProvider. Different failure mode
 * from the HTTP wrapper: a dropped WS connection doesn't return an error
 * you can catch inline — it fires async close/error events, and resuming
 * requires both reconnecting AND re-establishing subscriptions AND
 * recovering whatever events fired during the gap.
 *
 * Note: accesses provider.websocket, which is an ethers v6 implementation
 * detail, not a stable public API. Verify this against your installed
 * ethers version — it may need adjustment on major version bumps.
 */
export class ResilientWsProvider {
  private opts: Required<
    Pick<ResilientWsOptions, "maxReconnectAttempts" | "baseBackoffMs" | "maxBackoffMs">
  > &
    ResilientWsOptions;
  private current: ethers.WebSocketProvider | null = null;
  private currentEndpoint: WsEndpoint;
  private usingFallback = false;
  private reconnectAttempts = 0;
  private subscriptions: SubscriptionEntry[] = [];
  private manuallyClosed = false;
  private lastSeenBlock: number | null = null;

  constructor(opts: ResilientWsOptions) {
    this.opts = {
      maxReconnectAttempts: 5,
      baseBackoffMs: 1000,
      maxBackoffMs: 30_000,
      ...opts,
    };
    this.currentEndpoint = opts.primary;
  }

  async connect(): Promise<void> {
    this.manuallyClosed = false;
    await this.openConnection(this.currentEndpoint, /* isReconnect */ false);
  }

  private async openConnection(endpoint: WsEndpoint, isReconnect: boolean): Promise<void> {
    const provider = new ethers.WebSocketProvider(endpoint.wsUrl);
    this.current = provider;

    const ws: any = (provider as any).websocket;
    ws?.on?.("close", () => this.handleDisconnect(endpoint));
    ws?.on?.("error", (err: Error) => this.handleDisconnect(endpoint, err.message));

    // Confirms the socket is actually usable, not just open.
    await provider.getNetwork();

    const currentBlock = await provider.getBlockNumber();

    if (isReconnect && this.lastSeenBlock !== null && currentBlock > this.lastSeenBlock + 1) {
      await this.opts.onGapDetected?.(this.lastSeenBlock + 1, currentBlock);
    }
    this.lastSeenBlock = currentBlock;

    // Track block progression so future gaps are measurable.
    provider.on("block", (blockNumber: number) => {
      this.lastSeenBlock = blockNumber;
    });

    this.reconnectAttempts = 0;
    await this.restoreSubscriptions();
  }

  private async handleDisconnect(endpoint: WsEndpoint, reason = "connection closed") {
    if (this.manuallyClosed) return;

    this.reconnectAttempts++;

    if (this.reconnectAttempts <= this.opts.maxReconnectAttempts) {
      const backoff = Math.min(
        this.opts.baseBackoffMs * 2 ** (this.reconnectAttempts - 1),
        this.opts.maxBackoffMs
      );
      this.opts.onReconnectAttempt?.(endpoint.name, this.reconnectAttempts);
      await new Promise((r) => setTimeout(r, backoff));
      try {
        await this.openConnection(endpoint, true);
        return;
      } catch {
        // openConnection's own ws handlers will fire another disconnect
        // event and this loop continues, up to maxReconnectAttempts.
        return;
      }
    }

    // Reconnect attempts exhausted on this endpoint.
    if (!this.usingFallback) {
      this.usingFallback = true;
      this.currentEndpoint = this.opts.fallback;
      this.reconnectAttempts = 0;
      this.opts.onFailover?.(this.opts.primary.name, this.opts.fallback.name, reason);
      try {
        await this.openConnection(this.opts.fallback, true);
      } catch (err) {
        throw new Error(
          `Both primary (${this.opts.primary.name}) and fallback (${this.opts.fallback.name}) WS endpoints unreachable: ${(err as Error).message}`
        );
      }
    } else {
      // Fallback also exhausted — try primary again in case it recovered.
      this.usingFallback = false;
      this.currentEndpoint = this.opts.primary;
      this.reconnectAttempts = 0;
      try {
        await this.openConnection(this.opts.primary, true);
      } catch (err) {
        throw new Error(
          `Both endpoints unreachable after fallback also failed: ${(err as Error).message}`
        );
      }
    }
  }

  /** Register a subscription that survives reconnects and failovers. */
  on(event: ethers.EventFilter | string | Array<any>, listener: (...args: any[]) => void, id?: string): void {
    const entry: SubscriptionEntry = {
      id: id ?? `${JSON.stringify(event)}-${this.subscriptions.length}`,
      event,
      listener,
    };
    this.subscriptions.push(entry);
    this.current?.on(event, listener);
  }

  private async restoreSubscriptions(): Promise<void> {
    if (!this.current || this.subscriptions.length === 0) return;
    for (const sub of this.subscriptions) {
      this.current.on(sub.event, sub.listener);
    }
    this.opts.onSubscriptionsRestored?.(this.subscriptions.length);
  }

  getProvider(): ethers.WebSocketProvider {
    if (!this.current) throw new Error("WS provider not connected — call connect() first");
    return this.current;
  }

  async close(): Promise<void> {
    this.manuallyClosed = true;
    await this.current?.destroy();
  }
}

/*
Usage:

const ws = new ResilientWsProvider({
  primary: { name: "alchemy", wsUrl: process.env.ALCHEMY_CELO_WS! },
  fallback: { name: "quicknode", wsUrl: process.env.QUICKNODE_CELO_WS! },
  onFailover: (from, to, reason) => console.warn(`[WS] Failover ${from} -> ${to}: ${reason}`),
  onReconnectAttempt: (ep, attempt) => console.info(`[WS] Reconnecting to ${ep}, attempt ${attempt}`),
  onGapDetected: async (fromBlock, toBlock) => {
    // REQUIRED for correctness: query your actual contracts' logs for
    // this range and process any missed deposit/vote/vault events before
    // resuming live subscriptions. Do not skip this for money-moving events.
    await backfillMissedEvents(fromBlock, toBlock);
  },
});

await ws.connect();
ws.on(vaultContract.filters.Deposit(), (event) => handleDeposit(event));
*/