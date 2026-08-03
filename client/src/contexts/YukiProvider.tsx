import React, { createContext, useContext, useEffect, useRef, useCallback } from 'react';
import { useYukiStore } from '../stores/useYukiStore';
import type { YukiAlert, WsConnectionState } from '../stores/useYukiStore';
import { useDashboardPersona } from '../hooks/useDashboardPersona';
import { connectToYukiWebSocket, subscribeToPortfolio, subscribeToAlerts } from '../api/yukiApi';
import { getSharedSocket } from '../hooks/useSharedSocket';
// NOTE: auth here is cookie-based (httpOnly access_token cookie — see
// authClient.ts). There is no client-readable token to fetch or hold, so
// (unlike the previous version of this file) there is no auth-token hook
// dependency at all. Native WebSocket handshakes carry the browser's
// cookies for the target origin automatically — see connectToYukiWebSocket
// in yukiApi.ts, which no longer takes a token parameter for the same
// reason. The server-side WS upgrade handler for /api/v1/yuki/ws needs a
// matching change to read the cookie instead of expecting a query/auth
// token (mirroring the fix needed in server/index.ts's io.use()).

interface YukiContextValue {
  wsConnected: boolean;
  wsConnectionState: WsConnectionState;
  reconnect: () => void;
}

const YukiContext = createContext<YukiContextValue>({
  wsConnected: false,
  wsConnectionState: 'idle',
  reconnect: () => {},
});

const RECONNECT_BASE_MS = 1000;
const RECONNECT_MAX_MS = 30000;
const MAX_RECONNECT_ATTEMPTS = 10;
const HEARTBEAT_INTERVAL_MS = 25000;
const HEARTBEAT_TIMEOUT_MS = 10000;

function backoffDelay(attempt: number) {
  return Math.min(RECONNECT_BASE_MS * 2 ** attempt, RECONNECT_MAX_MS);
}

/**
 * Bridges a YUKI-origin alert into the app-wide toast/notification channels.
 *
 * THIS IS AN INTERIM FRONTEND WORKAROUND, not the fix.
 *
 * Per the review: useNotifications.ts listens for Socket.IO event
 * 'new_notification', AlertToastManager.tsx listens for 'alert:new', and the
 * backend already fans alerts out to Socket.IO via
 * notificationService.emit('notification_created', ...) → NEW_NOTIFICATION,
 * and via wsEmitter.emitAlert(...). YUKI's alert stream rides a *different*,
 * raw WebSocket connection (this one) that was never hooked into that fan-out.
 *
 * This function dispatches window CustomEvents with matching names so that
 * IF those two listeners are (or can be made) window-event listeners, they'll
 * pick this up. If they're actually bound to a socket.io-client instance
 * instead, this bridge will NOT reach them — window events and socket.io
 * client events are different transports and one cannot fake the other from
 * here.
 *
 * DURABLE FIX: route YUKI alert generation server-side through the same
 * notificationService / wsEmitter.emitAlert() path every other surface
 * already uses (per the WebSocket event registry built for all eight
 * surfaces). That way YUKI alerts arrive over the existing Socket.IO
 * NEW_NOTIFICATION channel your other listeners already consume, and this
 * bridge function — and the second raw WS connection — become unnecessary.
 */
function bridgeAlertToSharedChannels(alert: YukiAlert) {
  if (typeof window === 'undefined') return;

  const payload = {
    id: alert.id,
    severity: alert.severity,
    title: alert.title,
    message: alert.message,
    timestamp: alert.timestamp,
    source: alert.source,
    type: alert.severity === 'critical' ? 'alert' : 'info',
    createdAt: alert.timestamp,
  };

  window.dispatchEvent(new CustomEvent('alert:new', { detail: payload }));
  window.dispatchEvent(new CustomEvent('new_notification', { detail: payload }));

  try {
    const sharedSocket = getSharedSocket();
    if (sharedSocket?.connected) {
      sharedSocket.emit('alert:new', payload);
      sharedSocket.emit('new_notification', payload);
    }
  } catch (error) {
    console.warn('[YukiProvider] Failed to emit shared alert via socket', error);
  }
}

export function YukiProvider({ children }: { children: React.ReactNode }) {
  const { persona } = useDashboardPersona();

  const setActivePersona = useYukiStore((s) => s.setActivePersona);
  const setWsConnected = useYukiStore((s) => s.setWsConnected);
  const setWsConnectionState = useYukiStore((s) => s.setWsConnectionState);
  const setReconnectAttempts = useYukiStore((s) => s.setReconnectAttempts);
  const wsConnected = useYukiStore((s) => s.wsConnected);
  const wsConnectionState = useYukiStore((s) => s.wsConnectionState);

  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const heartbeatIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const heartbeatTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const attemptRef = useRef(0);
  const manualCloseRef = useRef(false);

  useEffect(() => {
    setActivePersona(persona);
  }, [persona, setActivePersona]);

  const clearHeartbeat = useCallback(() => {
    if (heartbeatIntervalRef.current) clearInterval(heartbeatIntervalRef.current);
    if (heartbeatTimeoutRef.current) clearTimeout(heartbeatTimeoutRef.current);
    heartbeatIntervalRef.current = null;
    heartbeatTimeoutRef.current = null;
  }, []);

  const startHeartbeat = useCallback(
    (ws: WebSocket) => {
      clearHeartbeat();
      heartbeatIntervalRef.current = setInterval(() => {
        if (ws.readyState !== WebSocket.OPEN) return;
        try {
          ws.send(JSON.stringify({ type: 'ping' }));
        } catch {
          return; // send failure surfaces via onclose/onerror
        }
        heartbeatTimeoutRef.current = setTimeout(() => {
          console.warn('[YukiProvider] Heartbeat timeout — forcing reconnect');
          ws.close();
        }, HEARTBEAT_TIMEOUT_MS);
      }, HEARTBEAT_INTERVAL_MS);
    },
    [clearHeartbeat]
  );

  const connect = useCallback(() => {
    setWsConnectionState(attemptRef.current > 0 ? 'reconnecting' : 'connecting');
    const ws = connectToYukiWebSocket();
    wsRef.current = ws;

    ws.onopen = () => {
      console.log('[YukiProvider] WS connected');
      attemptRef.current = 0;
      setReconnectAttempts(0);
      setWsConnected(true);
      setWsConnectionState('connected');
      startHeartbeat(ws);

      subscribeToPortfolio(ws);
      subscribeToAlerts(ws);
      // ASSUMPTION: yukiApi.ts multiplexes every Yuki surface (positions,
      // orders, exchanges, strategies, market, staking, rebalancing, bridge,
      // algo, trades) over this same connection, distinguished by `type` in
      // the message payload below. If some of these are actually separate
      // subscribe calls (e.g. subscribeToPositions(ws), subscribeToMarket(ws)),
      // add those calls here — the message handling below already covers the
      // corresponding payload shapes.
    };

    ws.onmessage = (event) => {
      let data: any;
      try {
        data = JSON.parse(event.data);
      } catch (err) {
        console.error('[YukiProvider] Failed to parse WS message', err);
        return;
      }

      const store = useYukiStore.getState();

      switch (data.type) {
        case 'pong':
          if (heartbeatTimeoutRef.current) {
            clearTimeout(heartbeatTimeoutRef.current);
            heartbeatTimeoutRef.current = null;
          }
          break;

        case 'portfolio_update':
          store.setPortfolioTotals(data.payload);
          break;

        case 'position_update':
          store.upsertPosition(data.payload);
          break;

        case 'positions_snapshot':
          store.setPositions(data.payload);
          break;

        case 'order_update':
          store.upsertOrder(data.payload);
          break;

        case 'orders_snapshot':
          store.setOpenOrders(data.payload);
          break;

        case 'exchanges_snapshot':
          store.setConnectedExchanges(data.payload);
          break;

        case 'strategies_snapshot':
          store.setStrategies(data.payload);
          break;

        case 'market_snapshot':
          store.setMarketOverview(data.payload);
          break;

        case 'market_update':
          store.upsertMarketSnapshot(data.payload);
          break;

        case 'sentiment_update':
          store.setCurrentSentiment(data.payload);
          break;

        case 'signals_update':
          store.setActiveSignals(data.payload);
          break;

        case 'risk_settings_update':
          store.updateRiskSettings(data.payload);
          break;

        case 'staking_snapshot':
          store.setStakingPositions(data.payload);
          break;

        case 'rebalancing_update':
          store.setRebalancingStatus(data.payload);
          break;

        case 'algo_status_update':
          store.setAlgoStatus(data.payload);
          break;

        case 'trade_executed':
          store.addTrade(data.payload);
          break;

        case 'bridge_tx_update': {
          const tx = data.payload;
          const exists = store.pendingCrossChainTxs.some((t) => t.id === tx.id);
          if (tx.status === 'pending') {
            exists ? store.updatePendingCrossChainTx(tx.id, tx) : store.addPendingCrossChainTx(tx);
          } else {
            store.removePendingCrossChainTx(tx.id);
          }
          break;
        }

        // ── This was the gap: YUKI alerts arrived here and went nowhere ────
        case 'alert': {
          const alert: YukiAlert = {
            id: data.payload?.id ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`,
            severity: data.payload?.severity ?? 'info',
            title: data.payload?.title ?? 'YUKI Alert',
            message: data.payload?.message ?? '',
            timestamp: data.payload?.timestamp ?? new Date().toISOString(),
            source: 'yuki',
            meta: data.payload?.meta,
          };
          store.addAlert(alert);
          bridgeAlertToSharedChannels(alert);
          break;
        }

        default:
          console.debug('[YukiProvider] Unhandled WS message type:', data.type);
      }
    };

    ws.onerror = (err) => {
      console.error('[YukiProvider] WS error', err);
    };

    ws.onclose = () => {
      console.log('[YukiProvider] WS disconnected');
      clearHeartbeat();
      setWsConnected(false);
      setWsConnectionState('disconnected');

      if (manualCloseRef.current) return;

      if (attemptRef.current >= MAX_RECONNECT_ATTEMPTS) {
        useYukiStore.getState().addAlert({
          id: `ws-giveup-${Date.now()}`,
          severity: 'critical',
          title: 'YUKI connection lost',
          message: 'Live trading data is disconnected. Refresh the page to retry.',
          timestamp: new Date().toISOString(),
          source: 'yuki',
        });
        return;
      }

      const delay = backoffDelay(attemptRef.current);
      attemptRef.current += 1;
      setReconnectAttempts(attemptRef.current);
      reconnectTimerRef.current = setTimeout(connect, delay);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clearHeartbeat, setReconnectAttempts, setWsConnected, setWsConnectionState, startHeartbeat]);

  const reconnect = useCallback(() => {
    attemptRef.current = 0;
    manualCloseRef.current = true;
    wsRef.current?.close();
    manualCloseRef.current = false;
    connect();
  }, [connect]);

  useEffect(() => {
    manualCloseRef.current = false;
    connect();

    return () => {
      manualCloseRef.current = true;
      if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current);
      clearHeartbeat();
      wsRef.current?.close();
    };
    // Runs once on mount; the connect/reconnect logic inside `connect` itself
    // handles the connection lifecycle from here. No token dependency since
    // auth rides the session cookie automatically.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <YukiContext.Provider value={{ wsConnected, wsConnectionState, reconnect }}>
      {children}
    </YukiContext.Provider>
  );
}

export const useYukiContext = () => useContext(YukiContext);