import { and, count, desc, eq } from 'drizzle-orm';
import { db } from '../db';
import { notifications, userNotificationPreferences } from '../../shared/schema';
import { NotFoundError } from '../middleware/errorHandler';

export type NotificationChannel = 'in_app' | 'email' | 'sms';

export interface UserNotification {
  id: string;
  userId: string;
  type: string;
  title: string;
  message: string;
  priority: string;
  channels: NotificationChannel[];
  data: Record<string, unknown>;
  actionUrl?: string;
  isRead: boolean;
  readAt: Date | null;
  deliveredAt: Date | null;
  expiresAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface GetUserNotificationsOptions {
  unreadOnly?: boolean;
  limit?: number;
  offset?: number;
}

export type UserNotificationPreferences = Pick<
  typeof userNotificationPreferences.$inferSelect,
  | 'paymentFailureEmail'
  | 'paymentFailureInApp'
  | 'retryUpdatesEmail'
  | 'retryUpdatesInApp'
  | 'recoveryHintsEmail'
  | 'recoveryHintsInApp'
  | 'systemAlertsEmail'
  | 'systemAlertsInApp'
  | 'emailFrequency'
>;

const preferenceFields = [
  'paymentFailureEmail',
  'paymentFailureInApp',
  'retryUpdatesEmail',
  'retryUpdatesInApp',
  'recoveryHintsEmail',
  'recoveryHintsInApp',
  'systemAlertsEmail',
  'systemAlertsInApp',
  'emailFrequency',
] as const;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function toUserNotification(row: typeof notifications.$inferSelect): UserNotification {
  const data = isRecord(row.metadata) ? row.metadata : {};
  const channels: NotificationChannel[] = Array.isArray(data.channels)
    ? data.channels.filter((channel): channel is NotificationChannel =>
        channel === 'in_app' || channel === 'email' || channel === 'sms'
      )
    : ['in_app'];
  const dateFromMetadata = (value: unknown): Date | null =>
    typeof value === 'string' || typeof value === 'number' ? new Date(value) : null;

  return {
    id: row.id,
    userId: row.userId,
    type: row.type,
    title: row.title,
    message: row.message,
    priority: row.priority ?? 'medium',
    channels,
    data,
    actionUrl: typeof data.actionUrl === 'string' ? data.actionUrl : undefined,
    isRead: row.read ?? false,
    readAt: dateFromMetadata(data.readAt),
    deliveredAt: dateFromMetadata(data.deliveredAt),
    expiresAt: dateFromMetadata(data.expiresAt),
    createdAt: row.createdAt ?? new Date(0),
    updatedAt: row.updatedAt ?? row.createdAt ?? new Date(0),
  };
}

export class UserNotificationService {
  static async getUserNotifications(
    userId: string,
    options: GetUserNotificationsOptions = {}
  ): Promise<{ notifications: UserNotification[]; total: number; unread: number }> {
    const limit = Math.max(1, Math.min(10000, Math.trunc(options.limit ?? 20)));
    const offset = Math.max(0, Math.trunc(options.offset ?? 0));
    const userFilter = eq(notifications.userId, userId);
    const unreadFilter = and(userFilter, eq(notifications.read, false));
    const listFilter = options.unreadOnly ? unreadFilter : userFilter;

    const [rows, totalRows, unreadRows] = await Promise.all([
      db.select().from(notifications).where(listFilter).orderBy(desc(notifications.createdAt)).limit(limit).offset(offset),
      db.select({ value: count() }).from(notifications).where(listFilter),
      db.select({ value: count() }).from(notifications).where(unreadFilter),
    ]);

    return {
      notifications: rows.map(toUserNotification),
      total: totalRows[0]?.value ?? 0,
      unread: unreadRows[0]?.value ?? 0,
    };
  }

  static async getNotification(userId: string, notificationId: string): Promise<UserNotification> {
    const [row] = await db.select().from(notifications).where(and(
      eq(notifications.id, notificationId),
      eq(notifications.userId, userId)
    )).limit(1);
    if (!row) throw new NotFoundError('Notification');
    return toUserNotification(row);
  }

  static async getUserPreferences(userId: string): Promise<UserNotificationPreferences> {
    const [row] = await db.select().from(userNotificationPreferences)
      .where(eq(userNotificationPreferences.userId, userId)).limit(1);
    if (row) return this.pickPreferences(row);

    const [created] = await db.insert(userNotificationPreferences).values({ userId })
      .onConflictDoNothing({ target: userNotificationPreferences.userId })
      .returning();
    if (created) return this.pickPreferences(created);
    const [existing] = await db.select().from(userNotificationPreferences)
      .where(eq(userNotificationPreferences.userId, userId)).limit(1);
    if (!existing) throw new Error('Could not initialize notification preferences');
    return this.pickPreferences(existing);
  }

  static async updateUserPreferences(
    userId: string,
    updates: Partial<UserNotificationPreferences>
  ): Promise<UserNotificationPreferences> {
    const safeUpdates: Partial<UserNotificationPreferences> = {};
    for (const field of preferenceFields) {
      const value = updates[field];
      if (value !== undefined) {
        if (field === 'emailFrequency') {
          if (value !== 'immediate' && value !== 'daily' && value !== 'weekly') {
            throw new Error('emailFrequency must be immediate, daily, or weekly');
          }
        } else if (typeof value !== 'boolean') {
          throw new Error(`${field} must be a boolean`);
        }
        Object.assign(safeUpdates, { [field]: value });
      }
    }

    const [row] = await db.insert(userNotificationPreferences)
      .values({ userId, ...safeUpdates })
      .onConflictDoUpdate({
        target: userNotificationPreferences.userId,
        set: { ...safeUpdates, updatedAt: new Date() },
      })
      .returning();
    return this.pickPreferences(row);
  }

  static async markAllAsRead(userId: string): Promise<{ updated: number }> {
    const rows = await db.update(notifications)
      .set({ read: true, updatedAt: new Date() })
      .where(and(eq(notifications.userId, userId), eq(notifications.read, false)))
      .returning({ id: notifications.id });
    return { updated: rows.length };
  }

  static async markAsRead(notificationId: string, userId: string): Promise<UserNotification> {
    const [row] = await db.update(notifications)
      .set({ read: true, updatedAt: new Date() })
      .where(and(eq(notifications.id, notificationId), eq(notifications.userId, userId)))
      .returning();
    if (!row) throw new NotFoundError('Notification');
    return toUserNotification(row);
  }

  static async deleteNotification(notificationId: string, userId: string): Promise<void> {
    const rows = await db.delete(notifications).where(and(
      eq(notifications.id, notificationId),
      eq(notifications.userId, userId)
    )).returning({ id: notifications.id });
    if (!rows.length) throw new NotFoundError('Notification');
  }

  private static pickPreferences(row: typeof userNotificationPreferences.$inferSelect): UserNotificationPreferences {
    return {
      paymentFailureEmail: row.paymentFailureEmail,
      paymentFailureInApp: row.paymentFailureInApp,
      retryUpdatesEmail: row.retryUpdatesEmail,
      retryUpdatesInApp: row.retryUpdatesInApp,
      recoveryHintsEmail: row.recoveryHintsEmail,
      recoveryHintsInApp: row.recoveryHintsInApp,
      systemAlertsEmail: row.systemAlertsEmail,
      systemAlertsInApp: row.systemAlertsInApp,
      emailFrequency: row.emailFrequency,
    };
  }
}
