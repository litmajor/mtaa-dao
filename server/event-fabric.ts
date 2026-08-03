import { EventEmitter } from 'events';
import type { Request, Response, NextFunction } from 'express';

export type EventFabricEvent = {
  type: string;
  payload: Record<string, unknown>;
  occurredAt: string;
};

class EventFabric extends EventEmitter {
  publish(type: string, payload: Record<string, unknown> = {}) {
    const event = { type, payload, occurredAt: new Date().toISOString() };
    this.emit(type, event);
    this.emit('event:published', event);
    return event;
  }

  subscribe(type: string, listener: (event: EventFabricEvent) => void) {
    this.on(type, listener);
    return () => this.off(type, listener);
  }
}

export function createRequestLifecycleMiddleware() {
  return (req: Request, res: Response, next: NextFunction) => {
    const startedAt = Date.now();
    const method = req.method;
    const path = req.originalUrl || req.url || '/';

    eventFabric.publish('server.request.started', { method, path, startedAt });

    const finalize = () => {
      const elapsedMs = Date.now() - startedAt;
      const statusCode = res.statusCode;
      eventFabric.publish('server.request.completed', { method, path, statusCode, elapsedMs });
    };

    req.on('close', finalize);
    res.on('finish', finalize);
    next();
  };
}

export const eventFabric = new EventFabric();
export default eventFabric;
