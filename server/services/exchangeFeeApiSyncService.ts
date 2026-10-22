import ccxt from 'ccxt';
import type { PoolClient } from 'pg';
import { pool } from '../db';
import { CEXCredentialRepository } from '../repositories/cexCredentialRepository';
import { exchangeFeeService, parseTradingPair, type ExchangeFeeInfo, type FeeStructure } from './exchangeFeeService';
import {
  createApiFeeScheduleVersion,
  listFeeScheduleVersions,
} from './exchangeFeeScheduleRepository';
import { logger } from '../utils/logger';

const DAILY_SYNC_INTERVAL_MS = 24 * 60 * 60 * 1000;
const API_SYNC_LOCK_KEY = 'exchange-fee-api-sync-v1';
const STABLE_SYMBOLS = new Set(['USD', 'EUR', 'USDT', 'USDC', 'FDUSD', 'BUSD', 'TUSD', 'USDP', 'CUSD', 'CEUR']);

export interface ExchangeFeeApiSyncStatus {
  lastRunAt: string | null;
  completedAt: string | null;
  attempted: number;
  updated: number;
  unchanged: number;
  unsupported: number;
  failed: number;
  skipped: boolean;
}

interface ExchangeTradingFee {
  maker?: unknown;
  taker?: unknown;
}

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? (sorted[middle - 1] + sorted[middle]) / 2
    : sorted[middle];
}

function normalizeTradingFees(exchange: string, response: unknown): ExchangeFeeInfo | null {
  if (!response || typeof response !== 'object' || Array.isArray(response)) return null;

  const pairFees: Record<string, FeeStructure> = {};
  for (const [symbol, rawFee] of Object.entries(response)) {
    if (!rawFee || typeof rawFee !== 'object') continue;
    const pair = parseTradingPair(symbol.split(':')[0]);
    const fee = rawFee as ExchangeTradingFee;
    const maker = Number(fee.maker);
    const taker = Number(fee.taker);
    if (!pair || !Number.isFinite(maker) || !Number.isFinite(taker) ||
        maker < 0 || taker < 0 || maker > 0.05 || taker > 0.05) {
      continue;
    }
    pairFees[`${pair.base}/${pair.quote}`] = { maker, taker };
  }

  const allFees = Object.values(pairFees);
  if (allFees.length === 0) return null;
  const stableFees = Object.entries(pairFees)
    .filter(([symbol]) => {
      const pair = parseTradingPair(symbol);
      return pair && STABLE_SYMBOLS.has(pair.base) && STABLE_SYMBOLS.has(pair.quote);
    })
    .map(([, fee]) => fee);
  const averageFee = (fees: FeeStructure[]): FeeStructure => ({
    maker: median(fees.map((fee) => fee.maker)),
    taker: median(fees.map((fee) => fee.taker)),
  });
  const baseStructure = averageFee(allFees);

  return {
    exchange: exchange.toLowerCase(),
    asOf: new Date().toISOString(),
    source: 'credential-authenticated-api',
    baseStructure,
    volumeTiers: [],
    stablecoinPairs: stableFees.length ? averageFee(stableFees) : baseStructure,
    pairFees,
  };
}

class ExchangeFeeApiSyncService {
  private timer: NodeJS.Timeout | null = null;
  private status: ExchangeFeeApiSyncStatus = {
    lastRunAt: null,
    completedAt: null,
    attempted: 0,
    updated: 0,
    unchanged: 0,
    unsupported: 0,
    failed: 0,
    skipped: false,
  };

  start(): void {
    if (this.timer) return;
    const run = () => {
      void this.syncActiveCredentials().catch((error) => {
        logger.error('Credential-scoped exchange fee sync could not start', {
          message: error instanceof Error ? error.message : String(error),
        });
      });
    };
    run();
    this.timer = setInterval(run, DAILY_SYNC_INTERVAL_MS);
    this.timer.unref();
  }

  getStatus(): ExchangeFeeApiSyncStatus {
    return { ...this.status };
  }

  async syncActiveCredentials(): Promise<void> {
    let client: PoolClient | null = null;
    let lockAcquired = false;
    const runAt = new Date().toISOString();
    const run: ExchangeFeeApiSyncStatus = {
      lastRunAt: runAt,
      completedAt: null,
      attempted: 0,
      updated: 0,
      unchanged: 0,
      unsupported: 0,
      failed: 0,
      skipped: false,
    };

    try {
      client = await pool.connect();
      const lock = await client.query<{ acquired: boolean }>(
        'SELECT pg_try_advisory_lock(hashtext($1)) AS acquired',
        [API_SYNC_LOCK_KEY]
      );
      lockAcquired = lock.rows[0]?.acquired === true;
      if (!lockAcquired) {
        this.status = { ...run, skipped: true, completedAt: new Date().toISOString() };
        return;
      }

      const credentials = await CEXCredentialRepository.getAllActiveCredentials();
      for (const metadata of credentials) {
        const current = exchangeFeeService.getCurrentScheduleVersion(metadata.exchange, metadata.userId);
        const lastCheckedAt = current?.lastCheckedAt ?? current?.effectiveFrom;
        if (lastCheckedAt && Date.now() - Date.parse(lastCheckedAt) < DAILY_SYNC_INTERVAL_MS) continue;

        run.attempted += 1;
        try {
          const credential = await CEXCredentialRepository.getCredentialsById(metadata.id, true);
          if (!credential) continue;
          const exchangeName = metadata.exchange.toLowerCase();
          const ExchangeClass = ccxt[exchangeName as keyof typeof ccxt] as unknown as
            (new (options: Record<string, unknown>) => {
              fetchTradingFees?: () => Promise<unknown>;
              loadMarkets?: () => Promise<unknown>;
              setSandboxMode?: (enabled: boolean) => void;
              close?: () => Promise<void>;
            });
          const exchange = new ExchangeClass({
            apiKey: credential.apiKey,
            secret: credential.apiSecret,
            password: credential.passphrase,
            enableRateLimit: true,
            timeout: 3000,
          });
          if (credential.isSandbox) exchange.setSandboxMode?.(true);

          let response: unknown;
          let requestError: unknown;
          try {
            if (typeof exchange.fetchTradingFees !== 'function') {
              run.unsupported += 1;
              continue;
            }
            await exchange.loadMarkets?.();
            response = await exchange.fetchTradingFees();
          } catch (error) {
            requestError = error;
          } finally {
            try {
              await exchange.close?.();
            } catch (error) {
              if (!requestError) requestError = error;
            }
          }
          if (requestError) throw requestError;

          const schedule = normalizeTradingFees(exchangeName, response);
          if (!schedule) throw new Error('Exchange returned no valid symbol fee data');
          exchangeFeeService.validateSchedule(schedule);
          const saved = await createApiFeeScheduleVersion(schedule, metadata.userId);
          if (saved.changed) run.updated += 1;
          else run.unchanged += 1;
        } catch {
          run.failed += 1;
          logger.warn('Credential-scoped exchange fee sync failed', {
            exchange: metadata.exchange,
          });
        }
      }

      exchangeFeeService.loadScheduleVersions(await listFeeScheduleVersions());
      run.completedAt = new Date().toISOString();
      this.status = run;
      logger.info('Credential-scoped exchange fee sync completed', {
        attempted: run.attempted,
        updated: run.updated,
        unchanged: run.unchanged,
        unsupported: run.unsupported,
        failed: run.failed,
      });
    } catch (error) {
      run.completedAt = new Date().toISOString();
      run.failed += 1;
      this.status = run;
      logger.error('Credential-scoped exchange fee sync could not complete', {
        message: error instanceof Error ? error.message : String(error),
      });
    } finally {
      try {
        if (lockAcquired && client) {
          await client.query('SELECT pg_advisory_unlock(hashtext($1))', [API_SYNC_LOCK_KEY]);
        }
      } finally {
        client?.release();
      }
    }
  }
}

export const exchangeFeeApiSyncService = new ExchangeFeeApiSyncService();
