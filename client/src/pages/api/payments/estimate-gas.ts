import type { NextApiRequest, NextApiResponse } from 'next';
import { ethers } from 'ethers';

const CELO_RPC_URL = process.env.CELO_RPC_URL || 'https://forno.celo.org'; // Example Celo RPC
const ETH_RPC_URL = process.env.ETH_RPC_URL || 'https://mainnet.infura.io/v3/YOUR_INFURA_KEY';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { currency, amount } = req.query;
  let gasFee = '0.001';

  try {
    if (currency === 'CELO') {
      const provider = new ethers.JsonRpcProvider(CELO_RPC_URL);
      // Estimate gas for a simple transfer
      const feeData = await provider.getFeeData();
      const gasPrice = feeData.gasPrice ? Number(feeData.gasPrice) : 0;
      const estimatedGas = 21000; // Standard transfer
      const totalFee = gasPrice * estimatedGas;
      gasFee = (totalFee / 1e18).toString();
    } else if (currency === 'ETH') {
      const provider = new ethers.JsonRpcProvider(ETH_RPC_URL);
      const feeData = await provider.getFeeData();
      const gasPrice = feeData.gasPrice ? Number(feeData.gasPrice) : 0;
      const estimatedGas = 21000;
      const totalFee = gasPrice * estimatedGas;
      gasFee = (totalFee / 1e18).toString();
    } else if (currency === 'cUSD' || currency === 'USDC') {
      // For stablecoins, you may need to estimate token transfer gas
      // This is a placeholder; you should use contract ABI and estimateGas
      gasFee = '0.003'; // Replace with real logic
    }
    // Add more logic for other currencies/providers as needed
  } catch (error) {
    gasFee = '0';
  }

  res.status(200).json({ gasFee });
}
