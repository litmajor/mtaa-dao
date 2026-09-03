import { eq } from 'drizzle-orm';
import { db } from '../db';
import { userNotificationPreferences } from '../../shared/schema';

export type TelegramNotificationCategory = 'governance' | 'treasury' | 'membership' | 'voting' | 'announcements';

const categoryColumns = {
  governance: userNotificationPreferences.proposalUpdates,
  treasury: userNotificationPreferences.treasuryUpdates,
  membership: userNotificationPreferences.membershipUpdates,
  voting: userNotificationPreferences.votingReminders,
  announcements: userNotificationPreferences.daoAnnouncements,
} as const;

export async function getTelegramNotificationPreferences(userId: string) {
  const [preferences] = await db.select().from(userNotificationPreferences).where(eq(userNotificationPreferences.userId, userId));
  return preferences || null;
}

export async function isTelegramNotificationEnabled(userId: string, category: TelegramNotificationCategory): Promise<boolean> {
  const preferences = await getTelegramNotificationPreferences(userId);
  if (!preferences || preferences.unsubscribeAll || !preferences.telegramNotifications) return false;
  return Boolean(preferences[categoryColumns[category].name as keyof typeof preferences]);
}

export async function updateTelegramNotificationPreferences(
  userId: string,
  updates: Partial<Pick<typeof userNotificationPreferences.$inferInsert, 'telegramNotifications' | 'proposalUpdates' | 'treasuryUpdates' | 'membershipUpdates' | 'votingReminders' | 'daoAnnouncements' | 'unsubscribeAll'>>,
) {
  const [updated] = await db.update(userNotificationPreferences)
    .set({ ...updates, updatedAt: new Date() })
    .where(eq(userNotificationPreferences.userId, userId))
    .returning();
  return updated || null;
}
