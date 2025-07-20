
// Example: Copying only the relevant user functions for OAuth
import { db } from '../../../server/db';
import { users } from '../../../shared/schema';
import { eq } from 'drizzle-orm';
import jwt from 'jsonwebtoken';
const JWT_SECRET = process.env.JWT_SECRET || 'changeme';

export async function getUserByEmail(email: string): Promise<any> {
  if (!email) throw new Error('Email required');
  const result = await db.select().from(users).where(eq(users.email, email));
  return result[0] || null;
}

export async function createUser(userData: any): Promise<any> {
  const allowed: any = (({ firstName, lastName, email, phone, googleId, telegramId, name, avatar, provider }) => ({ firstName, lastName, email, phone, googleId, telegramId, name, avatar, provider }))(userData);
  allowed.createdAt = new Date();
  allowed.updatedAt = new Date();
  const result = await db.insert(users).values(allowed).returning();
  if (!result[0]) throw new Error('Failed to create user');
  return result[0];
}

export async function loginUser(res: any, user: any): Promise<void> {
  // Real session: set JWT cookie
  const token = jwt.sign({ userId: user.id }, JWT_SECRET, { expiresIn: '7d' });
  res.setHeader('Set-Cookie', `token=${token}; Path=/; HttpOnly; SameSite=Strict; Secure`);
}

export async function getUserById(id: string): Promise<any> {
  if (!id) throw new Error('User ID required');
  const result = await db.select().from(users).where(eq(users.id, id));
  return result[0] || null;
}

export async function getUserByPhone(phone: string): Promise<any> {
  if (!phone) throw new Error('Phone required');
  const result = await db.select().from(users).where(eq(users.phone, phone));
  return result[0] || null;
}

export async function updateUser(id: string, updates: any): Promise<any> {
  if (!id) throw new Error('User ID required');
  updates.updatedAt = new Date();
  const result = await db.update(users).set(updates).where(eq(users.id, id)).returning();
  if (!result[0]) throw new Error('Failed to update user');
  return result[0];
}

export async function deleteUser(id: string): Promise<boolean> {
  if (!id) throw new Error('User ID required');
  const result = await db.delete(users).where(eq(users.id, id)).returning();
  return !!result[0];
}

export async function logout(res: any) {
  if (!res) throw new Error('Response object required for logout');
  // Clear the token cookie
  res.setHeader('Set-Cookie', 'token=; Path=/; Expires=Thu, 01 Jan 1970 00:00:00 GMT; HttpOnly; SameSite=Strict; Secure');
}
import { NextApiRequest, NextApiResponse } from 'next';

export async function getUserFromToken(req: NextApiRequest): Promise<any> {
  const token = req.cookies.token;
  if (!token) return null;

  try {
    const decoded: any = jwt.verify(token, JWT_SECRET);
    return await getUserById(decoded.userId);
  } catch (error) {
    console.error('Failed to verify token:', error);
    return null;
  }
};

export const storage = {
  getUserByEmail,
  createUser,
  loginUser,
  getUserById,
  getUserByPhone,
  updateUser,
  deleteUser,
  logout,
  getUserFromToken,
};

export {db, users, JWT_SECRET}; // Export db and schema for use in API routes 