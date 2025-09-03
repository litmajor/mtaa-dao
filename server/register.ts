import type { NextApiRequest, NextApiResponse } from 'next';
import bcrypt from 'bcryptjs';
import { db } from '../server/db';
// Update the import path below if your schema file is located elsewhere
// Update the import path below if your schema file is located elsewhere
import { users } from '../shared/schema';
import { eq, or } from 'drizzle-orm';
import { v4 as uuidv4 } from 'uuid';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { emailOrPhone, password } = req.body;
  if (!emailOrPhone || !password) {
    return res.status(400).json({ error: 'Missing fields' });
  }

  // Check if user already exists (by email or phone)
  const existing = await db.select().from(users)
    .where(or(eq(users.email, emailOrPhone), eq(users.phone, emailOrPhone)));
  if (existing.length > 0) {
    return res.status(409).json({ error: 'User already exists' });
  }

  // Hash password
  const hashed = await bcrypt.hash(password, 10);
  const userId = uuidv4();
  const isEmail = emailOrPhone.includes('@');
  const newUser = {
    id: userId,
    email: isEmail ? emailOrPhone : null,
    phone: !isEmail ? emailOrPhone : null,
    password: hashed,
    joinedAt: new Date(),
    createdAt: new Date(),
    updatedAt: new Date(),
  };
  await db.insert(users).values(newUser);

  return res.status(201).json({ userId });
}
