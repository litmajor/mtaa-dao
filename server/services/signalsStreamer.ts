/**
 * Signals Streamer — SSE + Redis Pub/Sub Bridge
 * 
 * Uses UnifiedRedisService for all Redis operations.
 * 
 * Routes:
 *   • GET /api/signals/stream  → SSE connection
 *   • GET /api/signals/poll    → Last N signals (JSON array)
 *   • POST /api/signals/publish → Admin endpoint to inject signals
 * 
 * Redis channels:
 *   • signals:price
 *   • signals:opportunity
 *   • signals:strategy
 *   • signals:system
 */

import type { Request, Response } from 'express';
import { redisService } from './redis';
import { logger } from '../utils/logger';
import { getRedisSubscriptionManager } from './redisSubscriptionManager';

// In-memory ring buffer for polling fallback (last 100 signals)
export interface LiveSignal {
  id: string;
  type: string; // 'price' | 'opportunity' | 'strategy' | 'system' etc.
  severity?: string;
  title?: string;
  message?: string;
  symbol?: string;
  metadata?: Record<string, any> | null;
  timestamp: number;
}

const signalBuffer: LiveSignal[] = [];
const BUFFER_SIZE = 100;

const CHANNELS = ['signals:price', 'signals:opportunity', 'signals:strategy', 'signals:system'];

/**
 * Publish a signal to Redis and the local buffer.
 * Called by OHLCVService, strategy engine, alert system, etc.
 */
export async function publishSignal(signal: LiveSignal): Promise<void> {
  const normalized: LiveSignal = { ...signal, timestamp: signal.timestamp || Date.now() };
  const channel = `signals:${normalized.type || 'system'}`;
  const payload = JSON.stringify(normalized);

  // Add to local buffer for polling clients
  signalBuffer.unshift(normalized);
  if (signalBuffer.length > BUFFER_SIZE) signalBuffer.pop();

  // Publish to Redis for SSE subscribers
  try {
    await redisService.publish(channel, payload);
  } catch (e: any) {
    logger.debug('[SignalsStreamer] Redis publish failed:', e.message);
  }
}

/**
 * SSE handler: /api/signals/stream
 */
export async function signalsStreamHandler(req: Request, res: Response): Promise<void> {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');

  res.write(`data: ${JSON.stringify({ type: 'system', message: 'connected' })}\n\n`);

  let disposeSubscriptions: (() => Promise<void>) | null = null;
  let heartbeatTimer: NodeJS.Timeout | null = null;
  let isClosed = false;

  try {
    const manager = await getRedisSubscriptionManager();

    disposeSubscriptions = await manager.subscribeMany(CHANNELS, (message: string) => {
      if (!isClosed) res.write(`data: ${message}\n\n`);
    });

    heartbeatTimer = setInterval(() => {
      if (!isClosed) res.write(`:heartbeat\n\n`);
    }, 30000);

    req.on('close', async () => {
      isClosed = true;
      if (heartbeatTimer) clearInterval(heartbeatTimer);
      if (disposeSubscriptions) {
        try { await disposeSubscriptions(); } catch {}
      }
      res.end();
    });
  } catch (error) {
    logger.error('[SignalsStreamer] SSE setup failed:', error);
    res.write(`data: ${JSON.stringify({ type: 'system', error: 'Redis subscriber unavailable' })}\n\n`);
    res.end();
  }
}

/**
 * Polling fallback: /api/signals/poll
 */
export function signalsPollHandler(req: Request, res: Response): void {
  const { since, limit = '20' } = req.query;
  const sinceTs = since ? parseInt(String(since), 10) : 0;
  const lim = Math.min(parseInt(String(limit), 10) || 20, 100);

  const filtered = signalBuffer
    .filter((s) => (s.timestamp || 0) > sinceTs)
    .slice(0, lim);

  res.json(filtered);
}

/**
 * Admin endpoint: POST /api/signals/publish
 */
export async function signalsPublishHandler(req: Request, res: Response): Promise<void> {
  const { type, severity, title, message, symbol, metadata } = req.body;

  if (!type || !title) {
    res.status(400).json({ status: 'error', error: 'Missing required fields: type, title' });
    return;
  }

  await publishSignal({
    id: `manual-${Date.now()}`,
    type,
    severity: severity || 'low',
    title,
    message: message || title,
    symbol,
    metadata,
    timestamp: Date.now(),
  });

  res.json({ status: 'success', message: 'Signal published' });
}