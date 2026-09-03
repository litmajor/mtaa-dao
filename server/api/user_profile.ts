import type { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import { db } from '../storage';
import { users, userIdentities } from '../../shared/schema';
import { eq, and } from 'drizzle-orm';
import { Logger } from '../utils/logger';
import { ValidationError, AppError } from '../middleware/errorHandler';

const logger = new Logger('user-profile');

// Helper to extract authenticated user ID
function getAuthUserId(req: Request): string {
  const userId = (req as any).user?.userId || (req as any).user?.claims?.sub;
  if (!userId) {
    throw new AppError('Authentication required', 401);
  }
  return userId;
}

// Get user profile
export async function getUserProfileHandler(req: Request, res: Response) {
  const userId = getAuthUserId(req);

  const [user] = await db
    .select({
      id: users.id,
      username: users.username,
      email: users.email,
      firstName: users.firstName,
      lastName: users.lastName,
      profilePicture: users.profilePicture,
      bio: users.bio,
      location: users.location,
      website: users.website,
      telegramUsername: users.telegramUsername,
      walletAddress: users.walletAddress,
      roles: users.roles,
      isEmailVerified: users.isEmailVerified,
      createdAt: users.createdAt,
      lastLoginAt: users.lastLoginAt,
    })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  if (!user) {
    throw new AppError('User not found', 404);
  }

  const linkedIdentities = await db
    .select({
      provider: userIdentities.provider,
    })
    .from(userIdentities)
    .where(eq(userIdentities.userId, userId));

  const authProviders = [...new Set(linkedIdentities.map((identity) => identity.provider))];
  const signInMethod = authProviders[0] ?? (user.email ? 'email' : 'unknown');

  res.json({
    success: true,
    data: {
      user: {
        ...user,
        username: user.username,
        authProviders,
        signInMethod,
      },
    },
  });
}

// Update user profile
export async function updateUserProfileHandler(req: Request, res: Response) {
  const userId = getAuthUserId(req);
  const {
    firstName,
    lastName,
    username,
    bio,
    location,
    website,
    telegramUsername,
    profilePicture,
  } = req.body;

  // Validate website protocol if provided
  let sanitizedWebsite: string | null | undefined = undefined;
  if (website !== undefined) {
    if (website && typeof website === 'string' && website.trim()) {
      try {
        const parsedUrl = new URL(website.trim());
        if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
          throw new ValidationError('Website must use HTTP or HTTPS protocol');
        }
        sanitizedWebsite = parsedUrl.toString();
      } catch (err) {
        if (err instanceof ValidationError) throw err;
        throw new ValidationError('Invalid website URL format');
      }
    } else {
      sanitizedWebsite = null;
    }
  }

  const formatField = (val: unknown) => 
    val !== undefined ? (typeof val === 'string' && val.trim() ? val.trim() : null) : undefined;

  const updateData: Record<string, any> = {
    firstName: formatField(firstName),
    lastName: formatField(lastName),
    username: formatField(username),
    bio: formatField(bio),
    location: formatField(location),
    website: sanitizedWebsite,
    telegramUsername: formatField(telegramUsername),
    profilePicture: formatField(profilePicture),
    updatedAt: new Date(),
  };

  // Strip undefined values so Drizzle only updates fields explicitly provided
  Object.keys(updateData).forEach((key) => {
    if (updateData[key] === undefined) delete updateData[key];
  });

  const [updatedUser] = await db
    .update(users)
    .set(updateData)
    .where(eq(users.id, userId))
    .returning({
      id: users.id,
      username: users.username,
      email: users.email,
      firstName: users.firstName,
      lastName: users.lastName,
      profilePicture: users.profilePicture,
      bio: users.bio,
      location: users.location,
      website: users.website,
      telegramUsername: users.telegramUsername,
      updatedAt: users.updatedAt,
    });

  if (!updatedUser) {
    throw new AppError('User not found', 404);
  }

  logger.info('User profile updated', { userId });
  res.json({ success: true, data: { user: updatedUser } });
}

// Change password
export async function changePasswordHandler(req: Request, res: Response) {
  const userId = getAuthUserId(req);
  const { currentPassword, newPassword } = req.body;

  if (!currentPassword || !newPassword) {
    throw new ValidationError('Current password and new password are required');
  }

  if (typeof newPassword !== 'string' || newPassword.length < 8) {
    throw new ValidationError('New password must be at least 8 characters long');
  }

  const [user] = await db
    .select({ password: users.password })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  if (!user) {
    throw new AppError('User not found', 404);
  }

  if (!user.password) {
    throw new ValidationError('Account was created without a password. Please use password reset to establish one.');
  }

  const isValidPassword = await bcrypt.compare(currentPassword, user.password);
  if (!isValidPassword) {
    throw new ValidationError('Current password is incorrect');
  }

  const hashedNewPassword = await bcrypt.hash(newPassword, 12);

  await db
    .update(users)
    .set({
      password: hashedNewPassword,
      updatedAt: new Date(),
    })
    .where(eq(users.id, userId));

  logger.info('User password changed', { userId });
  res.json({ success: true, message: 'Password changed successfully' });
}

// Update wallet address
export async function updateWalletAddressHandler(req: Request, res: Response) {
  const userId = getAuthUserId(req);
  const { walletAddress } = req.body;

  if (!walletAddress || typeof walletAddress !== 'string' || !walletAddress.trim()) {
    throw new ValidationError('Wallet address is required');
  }

  const normalizedAddress = walletAddress.trim().toLowerCase();

  if (!/^0x[a-f0-9]{40}$/.test(normalizedAddress)) {
    throw new ValidationError('Invalid Ethereum wallet address format');
  }

  const [existingUser] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.walletAddress, normalizedAddress))
    .limit(1);

  if (existingUser && existingUser.id !== userId) {
    throw new ValidationError('Wallet address is already registered to another account');
  }

  const [updatedUser] = await db
    .update(users)
    .set({
      walletAddress: normalizedAddress,
      updatedAt: new Date(),
    })
    .where(eq(users.id, userId))
    .returning({
      id: users.id,
      walletAddress: users.walletAddress,
    });

  if (!updatedUser) {
    throw new AppError('User not found', 404);
  }

  logger.info('User wallet address updated', { userId, walletAddress: normalizedAddress });
  res.json({ success: true, data: { user: updatedUser } });
}