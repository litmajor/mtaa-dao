import type { NextApiRequest, NextApiResponse } from 'next';
import { deployDaoContract } from '../../../../server/agent_wallet';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const daoData = req.body;
    // You may want to validate daoData here
    const result = await deployDaoContract(daoData);
    if (result.success) {
      return res.status(200).json({ daoAddress: result.daoAddress });
    } else {
      return res.status(500).json({ error: result.error || 'Deployment failed' });
    }
  } catch (error: any) {
    return res.status(500).json({ error: error.message || 'Internal server error' });
  }
}
