import type { NextApiRequest, NextApiResponse } from 'next';
import bcrypt from 'bcryptjs';
import { db } from '@/server/storage';
import { users } from '@/server/storage'; // Adjust the path to where your actual users table is defined
import { eq, or } from 'drizzle-orm';
import { v4 as uuidv4 } from 'uuid';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { email, phone, password } = req.body;
  if ((!email && !phone) || !password) {
    return res.status(400).json({ error: 'Missing fields' });
  }

  // Validate phone number (must start with + and country code, digits only)
  if (phone) {
    const phoneRegex = /^\+[1-9]\d{1,14}$/;
    if (!phoneRegex.test(phone)) {
      return res.status(400).json({ error: 'Invalid phone number. Use format +1234567890.' });
    }
  }

  // Validate email
  if (email) {
    const emailRegex = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ error: 'Invalid email address.' });
    }
  }

  // Check if user already exists (by email or phone)
  let existing = [];
  if (email) {
    existing = await db.select().from(users).where(eq(users.email, email));
  } else if (phone) {
    existing = await db.select().from(users).where(eq(users.phone, phone));
  }
  if (existing.length > 0) {
    return res.status(409).json({ error: 'User already exists' });
  }

  // Hash password
  const hashed = await bcrypt.hash(password, 10);
  const userId = uuidv4();
  const newUser = {
    id: userId,
    email: email || null,
    phone: phone || null,
    password: hashed,
    joinedAt: new Date(),
    createdAt: new Date(),
    updatedAt: new Date(),
  };
  await db.insert(users).values(newUser);

  return res.status(201).json({ userId });
}
