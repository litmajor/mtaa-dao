import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { db } from '../../db';
import { logger } from '../../utils/logger';
import { users } from '../../../shared/schema';
import { eq } from 'drizzle-orm';
import crypto from 'crypto';

const router = Router();

// Type guard for user record
function isUser(obj: any): obj is { id: string; email: string; password: string; roles: string } {
  return obj && typeof obj.id === 'string' && typeof obj.email === 'string' && typeof obj.password === 'string' && typeof obj.roles === 'string';
}

// POST /api/admin/auth/admin-login
router.post('/auth/admin-login', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ message: 'Email and password required' });
  }
  try {
    const userArr = await db.select().from(users).where(eq(users.email, email)).limit(1);
    const user = userArr[0];
    if (!isUser(user)) {
      return res.status(401).json({ message: 'Invalid credentials or not an admin/superuser' });
    }
    // Check if user has admin or superUser role, or has isSuperUser flag set
    const hasAdminAccess = user.roles === 'superUser' || user.roles === 'admin' || (user as any).isSuperUser === true;
    if (!hasAdminAccess) {
      return res.status(401).json({ message: 'Invalid credentials or not an admin/superuser' });
    }
    if (!user.password) {
      return res.status(401).json({ message: 'No password set for this user' });
    }
    const valid = await bcrypt.compare(password, user.password);
    if (!valid) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }
    const token = jwt.sign({ id: user.id, role: user.roles }, process.env.JWT_SECRET || 'changeme', { expiresIn: '1d' });
    
    // Return user object with superuser flag
    const responseUser = {
      id: user.id,
      email: user.email,
      firstName: user.firstName || '',
      lastName: user.lastName || '',
      phone: user.phone || null,
      role: user.roles,
      isSuperUser: user.roles === 'superUser' || (user as any).isSuperUser === true,
      isAdmin: user.roles === 'admin' || user.roles === 'superUser' || (user as any).isSuperUser === true,
      walletAddress: user.walletAddress || null,
      isEmailVerified: user.emailVerified || false,
      isPhoneVerified: user.phoneVerified || false,
      profilePicture: user.profileImageUrl || null,
    };
    
    res.json({ 
      success: true, 
      data: { 
        user: responseUser, 
        accessToken: token,
      } 
    });
  } catch (err) {
    logger.error('Admin login error:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

// POST /api/admin/auth/superuser-register
router.post('/auth/superuser-register', async (req, res) => {
  const { email, password, firstName, lastName, name } = req.body;
  if (!email || !password) {
    return res.status(400).json({ message: 'Email and password required' });
  }
  try {
    const existingArr = await db.select().from(users).where(eq(users.email, email)).limit(1);
    if (existingArr[0]) {
      return res.status(409).json({ message: 'Email already registered' });
    }
    const hash = await bcrypt.hash(password, 10);
    const [newUser] = await db.insert(users).values({
      id: crypto.randomUUID(),
      email,
      password: hash,
      name: name || firstName || '',
      firstName: firstName || '',
      lastName: lastName || '',
      roles: 'superUser',
      isSuperUser: true,
      isEmailVerified: true,
      createdAt: new Date(),
    }).returning();
    if (!newUser) {
      return res.status(500).json({ message: 'User creation failed' });
    }
    // Construct response with proper flags
    const responseUser = {
      id: newUser.id,
      email: newUser.email,
      firstName: newUser.firstName || '',
      lastName: newUser.lastName || '',
      role: newUser.roles,
      roles: newUser.roles,
      isSuperUser: newUser.isSuperUser === true,
      isAdmin: newUser.roles === 'superUser' || newUser.roles === 'admin',
    };
    const token = jwt.sign({ id: newUser.id, role: newUser.roles, isSuperUser: true }, process.env.JWT_SECRET || 'changeme', { expiresIn: '1d' });
    res.json({ success: true, data: { user: responseUser, accessToken: token } });
  } catch (err) {
    logger.error('Superuser register error:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

export default router;
