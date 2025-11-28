
import { db } from '../db';
import { daos, daoMemberships } from '../../shared/schema';
import { eq, and } from 'drizzle-orm';
import { Request, Response } from 'express';

export async function addElderToMultisigHandler(req: Request, res: Response) {
  const { daoId, userId } = req.body;
  
  // 1. Verify user is now an elder
  const membership = await db.query.daoMemberships.findFirst({
    where: and(
      eq(daoMemberships.daoId, daoId),
      eq(daoMemberships.userId, userId),
      eq(daoMemberships.role, 'elder')
    )
  });
  
  if (!membership) {
    return res.status(404).json({ error: 'User is not an elder' });
  }
  
  // 2. Get current signers
  const dao = await db.query.daos.findFirst({
    where: eq(daos.id, daoId)
  });
  
  if (!dao) {
    return res.status(404).json({ error: 'DAO not found' });
  }
  
  const currentSigners = (dao.treasurySigners as string[]) || [];
  
  // 3. Add if not already a signer
  if (!currentSigners.includes(userId)) {
    await db.update(daos)
      .set({
        treasurySigners: [...currentSigners, userId],
        updatedAt: new Date()
      })
      .where(eq(daos.id, daoId));
    
    return res.json({
      success: true,
      message: 'Elder added to multi-sig signers',
      totalSigners: currentSigners.length + 1
    });
  }
  
  return res.json({
    success: true,
    message: 'Elder already a signer',
    totalSigners: currentSigners.length
  });
}
