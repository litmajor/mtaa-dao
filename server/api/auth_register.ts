
import { Request, Response } from 'express';
import { db } from '../storage';
import { users } from '../../shared/schema';
import { eq } from 'drizzle-orm';
import { generateTokens, hashPassword } from '../auth';
import { otpService } from '../services/otpService';

export async function authRegisterHandler(req: Request, res: Response) {
  try {
    const { email, phone, password } = req.body;

    // Validate input - need either email or phone
    if ((!email && !phone) || !password) {
      return res.status(400).json({
        success: false,
        error: 'Email or phone, and password are required'
      });
    }

    if (password.length < 8) {
      return res.status(400).json({
        success: false,
        error: 'Password must be at least 8 characters'
      });
    }

    // Check if user already exists
    const existingUser = await db
      .select()
      .from(users)
      .where(
        email 
          ? eq(users.email, email)
          : eq(users.phone, phone!)
      )
      .limit(1);

    if (existingUser.length > 0) {
      return res.status(400).json({
        success: false,
        error: email 
          ? 'User with this email already exists'
          : 'User with this phone number already exists'
      });
    }

    // Generate and store OTP in Redis
    const identifier = email || phone!;
    const otp = await otpService.storeOTP(identifier, password);

    // Send OTP via email or SMS
    try {
      if (email) {
        await otpService.sendEmailOTP(email, otp);
      } else if (phone) {
        await otpService.sendSMSOTP(phone, otp);
      }
    } catch (sendError) {
      // Clean up OTP if sending fails
      await otpService.deleteOTP(identifier);
      throw new Error('Failed to send verification code. Please try again.');
    }

    // Log for development
    if (process.env.NODE_ENV === 'development') {
      console.log(`🔐 OTP for ${identifier}: ${otp}`);
    }

    res.status(200).json({
      success: true,
      message: `Verification code sent to your ${email ? 'email' : 'phone'}`
    });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({
      success: false,
      error: 'Registration failed'
    });
  }
}

// Verify OTP handler
export async function verifyOtpHandler(req: Request, res: Response) {
  try {
    const { email, phone, otp } = req.body;
    const identifier = email || phone;

    if (!identifier || !otp) {
      return res.status(400).json({
        success: false,
        error: 'Email/phone and OTP are required'
      });
    }

    // Verify OTP
    const verification = await otpService.verifyOTP(identifier, otp);
    
    if (!verification.valid) {
      return res.status(400).json({
        success: false,
        error: verification.error || 'Invalid OTP'
      });
    }

    // OTP verified, create user
    const hashedPassword = await hashPassword(verification.password!);

    const [newUser] = await db
      .insert(users)
      .values({
        id: crypto.randomUUID(),
        email: email || null,
        phone: phone || null,
        password: hashedPassword,
        firstName: '',
        lastName: '',
        roles: 'user',
        isEmailVerified: !!email,
        isPhoneVerified: !!phone,
        isBanned: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .returning();

    // Clean up OTP from Redis
    await otpService.deleteOTP(identifier);

    // Generate tokens
    const tokens = generateTokens({
      sub: newUser.id,
      email: newUser.email || newUser.phone || '',
      role: typeof newUser.roles === 'string' ? newUser.roles : 'user',
    });

    // Set refresh token cookie
    res.cookie('refreshToken', tokens.refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    });

    res.status(201).json({
      success: true,
      data: {
        user: {
          id: newUser.id,
          email: newUser.email,
          phone: newUser.phone,
          firstName: newUser.firstName,
          lastName: newUser.lastName,
          role: typeof newUser.roles === 'string' ? newUser.roles : 'user',
          walletAddress: newUser.walletAddress,
          isEmailVerified: newUser.isEmailVerified,
          isPhoneVerified: newUser.isPhoneVerified,
          profilePicture: newUser.profileImageUrl,
        },
        accessToken: tokens.accessToken,
      },
    });
  } catch (error) {
    console.error('OTP verification error:', error);
    res.status(500).json({
      success: false,
      error: 'OTP verification failed'
    });
  }
}

// Resend OTP handler
export async function resendOtpHandler(req: Request, res: Response) {
  try {
    const { email, phone } = req.body;
    const identifier = email || phone;

    if (!identifier) {
      return res.status(400).json({
        success: false,
        error: 'Email or phone is required'
      });
    }

    // Verify OTP data exists (to get the password)
    const existingData = await otpService.verifyOTP(identifier, '000000'); // Dummy verification to check existence
    if (!existingData.password) {
      return res.status(400).json({
        success: false,
        error: 'No active registration found. Please start registration again.'
      });
    }

    // Generate new OTP and store in Redis
    const otp = await otpService.storeOTP(identifier, existingData.password);

    // Send new OTP
    try {
      if (email) {
        await otpService.sendEmailOTP(email, otp);
      } else if (phone) {
        await otpService.sendSMSOTP(phone, otp);
      }
    } catch (sendError) {
      throw new Error('Failed to send verification code. Please try again.');
    }

    // Log for development
    if (process.env.NODE_ENV === 'development') {
      console.log(`🔐 New OTP for ${identifier}: ${otp}`);
    }

    res.status(200).json({
      success: true,
      message: `New verification code sent to your ${email ? 'email' : 'phone'}`
    });
  } catch (error) {
    console.error('Resend OTP error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to resend OTP'
    });
  }
}
