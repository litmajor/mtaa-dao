import { Router } from "express";
import { db } from "../db";
import { users, sessions } from "../../shared/schema";
import { eq, and } from "drizzle-orm";
import { authenticate } from "../auth";
import bcrypt from "bcryptjs";
import * as otplib from 'otplib';
import qrcode from 'qrcode';

const router = Router();

// PUT /api/account/password - Change password
router.put("/password", authenticate, async (req, res) => {
  try {
    const userId = req.user!.id;
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({ error: "Current and new password required" });
    }

    if (newPassword.length < 8) {
      return res.status(400).json({ error: "New password must be at least 8 characters" });
    }

    // Get user with password
    const user = await db.query.users.findFirst({
      where: eq(users.id, userId),
    });

    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    // Verify current password
  const isValid = await bcrypt.compare(currentPassword, user.password);
    if (!isValid) {
      return res.status(401).json({ error: "Current password is incorrect" });
    }

    // Hash new password
    const hashedPassword = await bcrypt.hash(newPassword, 10);

    // Update password
    await db
      .update(users)
      .set({
        password: hashedPassword,
        updatedAt: new Date(),
      })
      .where(eq(users.id, userId));

    res.json({ message: "Password updated successfully" });
  } catch (error) {
    console.error("Error updating password:", error);
    res.status(500).json({ error: "Failed to update password" });
  }
});

// POST /api/account/disable - Disable account (soft delete)
router.post("/disable", authenticate, async (req, res) => {
  try {
    const userId = req.user!.id;

    await db
      .update(users)
      .set({
        isActive: false,
        updatedAt: new Date(),
      })
      .where(eq(users.id, userId));

    // Delete all sessions
    await db.delete(sessions).where(eq(sessions.userId, userId));

    res.json({ message: "Account disabled successfully" });
  } catch (error) {
    console.error("Error disabling account:", error);
    res.status(500).json({ error: "Failed to disable account" });
  }
});

// PUT /api/account/enable - Re-enable account
router.put("/enable", authenticate, async (req, res) => {
  try {
    const userId = req.user!.id;

    await db
      .update(users)
      .set({
        isActive: true,
        updatedAt: new Date(),
      })
      .where(eq(users.id, userId));

    res.json({ message: "Account enabled successfully" });
  } catch (error) {
    console.error("Error enabling account:", error);
    res.status(500).json({ error: "Failed to enable account" });
  }
});

// DELETE /api/account/delete - Permanently delete account
router.delete("/delete", authenticate, async (req, res) => {
  try {
    const userId = req.user!.id;
    const { password } = req.body;

    if (!password) {
      return res.status(400).json({ error: "Password required for account deletion" });
    }

    // Get user with password
    const user = await db.query.users.findFirst({
      where: eq(users.id, userId),
    });

    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    // Verify password
  const isValid = await bcrypt.compare(password, user.password);
    if (!isValid) {
      return res.status(401).json({ error: "Incorrect password" });
    }

    // Delete user (cascading deletes handled by database)
    await db.delete(users).where(eq(users.id, userId));

    // Delete all sessions
    await db.delete(sessions).where(eq(sessions.userId, userId));

    res.json({ message: "Account deleted successfully" });
  } catch (error) {
    console.error("Error deleting account:", error);
    res.status(500).json({ error: "Failed to delete account" });
  }
});

// GET /api/account/sessions - Get active sessions
router.get("/sessions", authenticate, async (req, res) => {
  try {
    const userId = req.user!.id;
  const currentSessionId = (req as any).session?.id;

    const userSessions = await db.query.sessions.findMany({
      where: eq(sessions.userId, userId),
      orderBy: (sessions, { desc }) => [desc(sessions.createdAt)],
    });

    res.json(userSessions.map(s => {
      // Parse user agent to get device name
      const ua = s.userAgent || "";
      let deviceName = "Unknown Device";
      if (ua.includes("Chrome")) deviceName = "Chrome Browser";
      else if (ua.includes("Firefox")) deviceName = "Firefox Browser";
      else if (ua.includes("Safari")) deviceName = "Safari Browser";
      else if (ua.includes("Edge")) deviceName = "Edge Browser";
      
      return {
        id: s.id,
        deviceName,
        location: s.ipAddress || "Unknown Location",
  lastActive: s.createdAt?.toISOString(),
        current: s.id === currentSessionId,
      };
    }));
  } catch (error) {
    console.error("Error fetching sessions:", error);
    res.status(500).json({ error: "Failed to fetch sessions" });
  }
});

// DELETE /api/account/sessions/:id - Revoke session
router.delete("/sessions/:id", authenticate, async (req, res) => {
  try {
    const userId = req.user!.id;
    const sessionId = req.params.id;

    await db.delete(sessions).where(
      and(
        eq(sessions.id, sessionId),
        eq(sessions.userId, userId)
      )
    );

    res.json({ message: "Session revoked successfully" });
  } catch (error) {
    console.error("Error revoking session:", error);
    res.status(500).json({ error: "Failed to revoke session" });
  }
});

// POST /api/account/export - Export user data
router.post("/export", authenticate, async (req, res) => {
  try {
    const userId = req.user!.id;

    // Get all user data
    const user = await db.query.users.findFirst({
      where: eq(users.id, userId),
      columns: {
        password: false,
      },
    });

    const userVaults = await db.query.vaults.findMany({
      where: eq(require("../../shared/schema").vaults.ownerId, userId),
    });

    const userContributions = await db.query.contributions.findMany({
      where: eq(require("../../shared/schema").contributions.userId, userId),
    });

    const userActivities = await db.query.userActivities.findMany({
      where: eq(require("../../shared/schema").userActivities.userId, userId),
    });

    const exportData = {
      user,
      vaults: userVaults,
      contributions: userContributions,
      activities: userActivities,
      exportedAt: new Date().toISOString(),
    };

    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename="mtaadao-data-${userId}.json"`);
    res.json(exportData);
  } catch (error) {
    console.error("Error exporting data:", error);
    res.status(500).json({ error: "Failed to export data" });
  }
});

// POST /api/account/2fa/enable - Enable 2FA
router.post("/2fa/enable", authenticate, async (req, res) => {
  try {
    const userId = req.user!.id;
    const { method = 'authenticator' } = req.body;

    const user = await db.query.users.findFirst({
      where: eq(users.id, userId),
    });

    if (!user) return res.status(404).json({ error: "User not found" });

    let qrCodeUrl = "";
    let secret = "";

    if (method === 'authenticator') {
      secret = otplib.generateSecret();
      const label = (user.email ?? user.username ?? "") as string;
      const otpauth = otplib.generateURI({
        secret,
        label,
        issuer: 'MtaaDAO',
      });
      qrCodeUrl = await qrcode.toDataURL(otpauth);
    }

    await db.update(users)
      .set({ 
        twoFactorEnabled: true,
        twoFactorMethod: method,
        twoFactorSecret: secret || null,
        updatedAt: new Date() 
      })
      .where(eq(users.id, userId));

    res.json({ 
      success: true,
      message: "2FA setup initiated successfully",
      qrCode: qrCodeUrl,
      secret: secret
    });
  } catch (error) {
    console.error("Error enabling 2FA:", error);
    res.status(500).json({ error: "Failed to enable 2FA" });
  }
});

// POST /api/account/2fa/disable - Disable 2FA
router.post("/2fa/disable", authenticate, async (req, res) => {
  try {
    const userId = req.user!.id;

    const user = await db.query.users.findFirst({
      where: eq(users.id, userId),
    });

    if (!user) return res.status(404).json({ error: "User not found" });

    await db.update(users)
      .set({ 
        twoFactorEnabled: false,
        twoFactorSecret: null,
        updatedAt: new Date() 
      })
      .where(eq(users.id, userId));

    res.json({ 
      success: true,
      message: "2FA disabled successfully"
    });
  } catch (error) {
    console.error("Error disabling 2FA:", error);
    res.status(500).json({ error: "Failed to disable 2FA" });
  }
});

// GET /api/account/pin-settings - Fetch current PIN configuration
router.get("/pin-settings", authenticate, async (req, res) => {
  try {
    const userId = req.user!.id;
    const user = await db.query.users.findFirst({
      where: eq(users.id, userId),
    });

    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    res.json({
      hasPinSetup: !!user.appPin,
      pinEnabledForLogin: user.pinEnabledForLogin,
      pinEnabledForTransfers: user.pinEnabledForTransfers,
      pinEnabledFor2FA: user.pinEnabledFor2FA,
    });
  } catch (error) {
    console.error("Error fetching PIN settings:", error);
    res.status(500).json({ error: "Failed to fetch PIN settings" });
  }
});

// PUT /api/account/pin-settings - Update PIN toggles
router.put("/pin-settings", authenticate, async (req, res) => {
  try {
    const userId = req.user!.id;
    const { pinEnabledForLogin, pinEnabledForTransfers, pinEnabledFor2FA } = req.body;

    await db.update(users).set({
      pinEnabledForLogin,
      pinEnabledForTransfers,
      pinEnabledFor2FA,
    }).where(eq(users.id, userId));

    res.json({ success: true, message: "PIN settings updated" });
  } catch (error) {
    console.error("Error updating PIN settings:", error);
    res.status(500).json({ error: "Failed to update PIN settings" });
  }
});

// POST /api/account/pin - Set or update the 6-digit Application PIN
router.post("/pin", authenticate, async (req, res) => {
  try {
    const userId = req.user!.id;
    const { currentPin, newPin } = req.body;

    if (!newPin || newPin.length !== 4 && newPin.length !== 6 || !/^\d+$/.test(newPin)) {
      return res.status(400).json({ error: "New PIN must be 4 or 6 digits" });
    }

    const user = await db.query.users.findFirst({
      where: eq(users.id, userId),
    });

    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    // Verify current PIN if one exists
    if (user.appPin) {
      if (!currentPin) {
        return res.status(400).json({ error: "Current PIN is required to set a new PIN" });
      }
      const isValid = await bcrypt.compare(currentPin, user.appPin);
      if (!isValid) {
        return res.status(401).json({ error: "Current PIN is incorrect" });
      }
    }

    // Hash and store the new PIN
    const hashedPin = await bcrypt.hash(newPin, 10);
    
    await db.update(users).set({
      appPin: hashedPin
    }).where(eq(users.id, userId));

    res.json({ success: true, message: "Application PIN securely updated" });
  } catch (error) {
    console.error("Error updating PIN:", error);
    res.status(500).json({ error: "Failed to update PIN" });
  }
});

export default router;
