import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockCreateNotification, mockGetUserNotificationPreferences, mockEmitAlert } = vi.hoisted(() => ({
  mockCreateNotification: vi.fn(),
  mockGetUserNotificationPreferences: vi.fn(),
  mockEmitAlert: vi.fn(),
}));

vi.mock('nodemailer', () => ({
  default: {
    createTransport: vi.fn(() => ({
      sendMail: vi.fn(),
    })),
  },
}));

vi.mock('node-telegram-bot-api', () => ({
  default: vi.fn().mockImplementation(() => ({
    getMe: vi.fn().mockResolvedValue({ id: 1, username: 'bot' }),
    stopPolling: vi.fn(),
    onText: vi.fn(),
    on: vi.fn(),
    sendMessage: vi.fn(),
  })),
}));

vi.mock('../db', () => ({ db: {} }));

vi.mock('../storage', () => ({
  storage: {
    createNotification: mockCreateNotification,
    getUserNotificationPreferences: mockGetUserNotificationPreferences,
  },
}));

vi.mock('../middleware/websocket-event-emitter', () => ({
  getEventEmitter: () => ({ emitAlert: mockEmitAlert }),
}));

import { notificationService } from '../notificationService';

describe('notificationService.createNotification', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('emits the shared notification_created event without using the legacy alert emitter', async () => {
    const createdNotification = {
      id: 'n1',
      userId: 'user-123',
      type: 'test',
      title: 'Test',
      message: 'Hello',
      read: false,
      priority: 'medium',
      metadata: {},
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    mockCreateNotification.mockResolvedValue(createdNotification);
    mockGetUserNotificationPreferences.mockResolvedValue({
      emailNotifications: false,
      pushNotifications: false,
      telegramNotifications: false,
    });

    const listener = vi.fn();
    notificationService.on('notification_created', listener);

    const result = await notificationService.createNotification({
      userId: 'user-123',
      type: 'test',
      title: 'Test',
      message: 'Hello',
    });

    expect(result).toEqual(createdNotification);
    expect(mockCreateNotification).toHaveBeenCalledTimes(1);
    expect(mockGetUserNotificationPreferences).toHaveBeenCalledWith('user-123');
    expect(listener).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'n1', userId: 'user-123' })
    );
    expect(mockEmitAlert).not.toHaveBeenCalled();
  });

  it('skips persistence for ephemeral notifications and still emits the event', async () => {
    const listener = vi.fn();
    notificationService.on('notification_created', listener);

    const result = await notificationService.createNotification({
      userId: 'user-123',
      type: 'price_alert',
      title: 'Price alert',
      message: 'BTC crossed threshold',
      persist: false,
    });

    expect(result).toEqual(
      expect.objectContaining({ userId: 'user-123', type: 'price_alert', ephemeral: true })
    );
    expect(mockCreateNotification).not.toHaveBeenCalled();
    expect(listener).toHaveBeenCalledWith(
      expect.objectContaining({ userId: 'user-123', ephemeral: true })
    );
  });

  it('coalesces repeated notifications for the same burst key', async () => {
    const listener = vi.fn();
    notificationService.on('notification_created', listener);

    mockCreateNotification.mockResolvedValue({
      id: 'n1',
      userId: 'user-123',
      type: 'proposal_voted',
      title: 'Vote received',
      message: 'A vote was cast',
      read: false,
      priority: 'medium',
      metadata: {},
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    await notificationService.createNotification({
      userId: 'user-123',
      type: 'proposal_voted',
      title: 'Vote received',
      message: 'First vote',
      coalesceKey: 'proposal-42',
      coalesceWindowMs: 60000,
    });

    const secondResult = await notificationService.createNotification({
      userId: 'user-123',
      type: 'proposal_voted',
      title: 'Vote received',
      message: 'Second vote',
      coalesceKey: 'proposal-42',
      coalesceWindowMs: 60000,
    });

    expect(mockCreateNotification).toHaveBeenCalledTimes(1);
    expect(secondResult).toBeNull();
  });
});
