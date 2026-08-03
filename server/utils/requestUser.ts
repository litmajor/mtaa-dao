import type { Request } from 'express';

export function getRequestUserId(req: Request): string | undefined {
  const anyReq = req as any;
  return anyReq.user?.claims?.sub || anyReq.user?.id || anyReq.userId;
}
