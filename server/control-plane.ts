import { Request, Response, Router } from 'express';
import eventFabric from './event-fabric';

interface ControlPlaneState {
  enabled: boolean;
  reason: string;
  updatedAt: string;
}

const router = Router();
const state: ControlPlaneState = {
  enabled: false,
  reason: 'operational',
  updatedAt: new Date().toISOString(),
};

function buildSnapshot() {
  return {
    status: state.enabled ? 'degraded' : 'healthy',
    killSwitch: state,
    modules: ['admin', 'monitoring', 'recovery', 'audit', 'events'],
  };
}

router.get('/admin', (_req: Request, res: Response) => {
  res.json({ module: 'admin', status: 'available', routes: ['/api/admin', '/api/admin/health'] });
});

router.get('/monitoring', (_req: Request, res: Response) => {
  res.json({ module: 'monitoring', status: 'available', routes: ['/api/monitoring', '/metrics'] });
});

router.get('/recovery', (_req: Request, res: Response) => {
  res.json({ module: 'recovery', status: 'available', routes: ['/api/user/recovery'] });
});

router.get('/audit', (_req: Request, res: Response) => {
  res.json({ module: 'audit', status: 'available', eventSurface: 'event-fabric' });
});

router.get('/kill-switch', (_req: Request, res: Response) => {
  res.json({ ...state });
});

router.post('/kill-switch', (req: Request, res: Response) => {
  const enabled = Boolean(req.body?.enabled);
  const reason = typeof req.body?.reason === 'string' ? req.body.reason : 'manual';

  state.enabled = enabled;
  state.reason = reason;
  state.updatedAt = new Date().toISOString();

  eventFabric.publish('control-plane.kill-switch.updated', { enabled, reason, updatedAt: state.updatedAt });

  res.json({ ...state });
});

router.get('/snapshot', (_req: Request, res: Response) => {
  res.json(buildSnapshot());
});

export default router;
