import { db } from './db';
import { users } from '../shared/schema';
import { eq } from 'drizzle-orm';

/**
 * Upsert a user by Telegram ID and phone number.
 * If the user exists, update their phone. If not, create a new user.
 */
export async function upsertTelegramUser({ telegramId, phone, firstName, lastName, username, photoUrl }: {
  telegramId: string;
  phone?: string;
  firstName?: string;
  lastName?: string;
  username?: string;
  photoUrl?: string;
}) {
  // Try to find user by telegramId (store in users.id or a dedicated field)
  let user = await db.select().from(users).where(eq(users.id, telegramId)).then(rows => rows[0]);
  if (user) {
    // Update phone if changed
    if (phone && user.phone !== phone) {
      await db.update(users).set({ phone }).where(eq(users.id, telegramId));
    }
    return { ...user, phone };
  } else {
    // Create new user
    const newUser = {
      id: telegramId,
      phone,
      firstName,
      lastName,
      profileImageUrl: photoUrl,
      email: username ? `${username}@telegram` : undefined,
    };
    await db.insert(users).values(newUser);
    return newUser;
  }
}
