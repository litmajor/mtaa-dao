// Minimal typing: avoid requiring @types/next in the server build
type NextApiRequest = any;
type NextApiResponse = any;
import bcrypt from 'bcryptjs';
import { db } from '../server/db';
import { users } from '../shared/schema';
import { eq, or } from 'drizzle-orm';
import { v4 as uuidv4 } from 'uuid';
import { randomBytes } from 'crypto';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { emailOrPhone, password, username, name } = req.body;
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
  // generate a slug base: prefer username, else email local-part, else userId
  const base = (username || (isEmail ? emailOrPhone.split('@')[0] : emailOrPhone) || userId).toString();
  const normalize = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
  const baseSlug = normalize(base);

  // Try inserting with unique slug; on conflict for slug, retry with a short hex suffix.
  const maxAttempts = 5;
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const candidateSlug = attempt === 0 ? baseSlug : `${baseSlug}-${randomBytes(3).toString('hex')}`;
    const newUser = {
      id: userId,
      email: isEmail ? emailOrPhone : null,
      phone: !isEmail ? emailOrPhone : null,
      username: username || null,
      name: name || null,
      slug: candidateSlug,
      password: hashed,
      joinedAt: new Date(),
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    try {
      await db.insert(users).values(newUser);
      return res.status(201).json({ userId });
    } catch (err: any) {
      // Postgres unique violation
      if (err && err.code === '23505') {
        const constraint = err.constraint || '';
        const detail = String(err.detail || err.message || '');
        const isSlugConflict = constraint.includes('slug') || detail.includes('slug');
        if (isSlugConflict) {
          // if last attempt, return conflict
          if (attempt === maxAttempts - 1) {
            return res.status(409).json({ error: 'Could not generate unique slug; please retry' });
          }
          // otherwise try again with a new suffix
          continue;
        }

        // If the unique violation is on email/phone/username, surface as conflict
        return res.status(409).json({ error: 'User already exists' });
      }

      // Unknown error
       
      console.error('Error creating user:', err);
      return res.status(500).json({ error: 'Internal server error' });
    }
  }

  return res.status(500).json({ error: 'Failed to create user' });
}
