import { Router } from "express";
import { db } from "../db";
import { authenticate } from "../auth";
import { daos } from "../../shared/schema";
import crypto from "crypto";

const router = Router();

// POST /api/daos/:id/invite - Generate invite token
router.post("/:id/invite", authenticate, async (req, res) => {
  try {
    const userId = (req.user as any).id;
    const daoId = req.params.id as string;
    // Check DAO exists
    const dao = await db.query.daos.findFirst({ where: { id: daoId } });
    if (!dao) return res.status(404).json({ error: "DAO not found" });
    // Generate token
    const token = crypto.randomBytes(32).toString("hex");
    const expiresAt = new Date(Date.now() + 1000 * 60 * 60 * 24); // 24h expiry
    // Store invite
    await db.insert(daoInvites).values({
      dao_id: daoId,
      inviter_id: userId,
      token,
      expires_at: expiresAt,
      used: false,
      created_at: new Date(),
    });
    // Return invite link
    res.json({
      inviteUrl: `https://mtaa.dao/invite/${daoId}?ref=${userId}&token=${token}`,
      token,
      expiresAt,
    });
  } catch (error) {
    console.error("Error generating invite token:", error);
    res.status(500).json({ error: "Failed to generate invite token" });
  }
});

// POST /api/daos/:id/join-by-invite - Join DAO via invite token
router.post("/:id/join-by-invite", authenticate, async (req, res) => {
  try {
    const userId = (req.user as any).id;
    const daoId = req.params.id as string;
    const { token } = req.body;
    // Find invite
    const invite = await db.query.daoInvites.findFirst({
      where: {
        dao_id: daoId,
        token,
        used: false,
      },
    });
    if (!invite) return res.status(400).json({ error: "Invalid or expired invite token" });
    if (new Date(invite.expires_at) < new Date()) {
      return res.status(400).json({ error: "Invite token expired" });
    }
    // Add user as member
    await db.insert(daoMemberships).values({
      daoId,
      userId,
      role: "member",
      joinedAt: new Date(),
      referral: invite.inviter_id,
    });
  // Mark invite as used
  await db.update(daoInvites).set({ used: true }).where({ token });
    res.json({ success: true, message: "Joined DAO via invite" });
  } catch (error) {
    console.error("Error joining via invite:", error);
    res.status(500).json({ error: "Failed to join DAO via invite" });
  }
});

export default router;
