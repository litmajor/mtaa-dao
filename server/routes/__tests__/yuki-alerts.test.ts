import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../notificationService', () => ({
  notificationService: {
    createNotification: vi.fn(),
  },
}));

import { fanOutYukiAlert } from '../v1/yuki/alerts';
import { notificationService } from '../../notificationService';

describe('fanOutYukiAlert', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('forwards YUKI alerts into the shared notification service', async () => {
    vi.mocked(notificationService.createNotification).mockResolvedValue({ id: 'n1' } as any);

    await fanOutYukiAlert(
      {
        id: 'alert-1',
        symbol: 'ETH',
        type: 'liquidation',
        message: 'Liquidation threshold crossed',
        threshold: 0.2,
        metadata: { exchange: 'binance' },
        createdAt: new Date().toISOString(),
        createdBy: 'system',
      } as any,
      'user-123'
    );

    expect(notificationService.createNotification).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'user-123',
        type: 'yuki_alert',
        title: 'YUKI alert: liquidation',
        message: 'Liquidation threshold crossed',
        priority: 'high',
        metadata: expect.objectContaining({
          source: 'yuki',
          yukiAlertId: 'alert-1',
          symbol: 'ETH',
          exchange: 'binance',
        }),
      })
    );
  });
});
