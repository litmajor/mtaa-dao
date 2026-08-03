import { ethers } from 'ethers';
import { logger } from '../utils/logger';
import { createWalletIfValid } from '../utils/cryptoWallet';
import { resolveProviderUrls } from './providerBootstrap';
import { ResilientRpcProvider } from './resilientRpcProvider';

const providerUrls = resolveProviderUrls();
const AGENT_GATEWAY_ADDRESS = process.env.AGENT_PAYMENT_GATEWAY_ADDR || process.env.AGENT_GATEWAY_ADDR || '';
const RPC_URL = providerUrls.rpcUrl;
const PRIVATE_KEY = process.env.MPESA_PRIVATE_KEY || process.env.PRIVATE_KEY || '';

const GATEWAY_ABI = [
  'function payAgentInKES(bytes32 agentId,uint256 kesAmount,address payer,string mpesaTxHash)',
  'function configureAgent(bytes32 agentId,address agentAddress,uint256 feeInKES,uint256 feeInUSD,uint8 defaultTier,uint256 defaultSubscriptionDuration,uint256 payoutPercentage,uint256 treasuryPercentage,uint256 communityPercentage,bool acceptsMTAA,bool acceptsKES)',
  'function settleKESPayment(uint256 paymentId)',
  'function getMtaaToKESRate() view returns (uint256)',
  'function getAgentAddress(bytes32 agentId) view returns (address)'
];

let provider: ethers.JsonRpcProvider | null = null;
let resilientProvider: ResilientRpcProvider | null = null;
let wallet: ethers.Wallet | null = null;
let contract: ethers.Contract | null = null;

function init() {
  if (contract) return;
  if (!RPC_URL) throw new Error('RPC_URL not configured');
  if (!PRIVATE_KEY) throw new Error('PRIVATE_KEY (MPESA signer) not configured');
  if (!AGENT_GATEWAY_ADDRESS) throw new Error('AGENT_PAYMENT_GATEWAY_ADDR not configured');
  resilientProvider = new ResilientRpcProvider({
    primary: { name: 'primary-rpc', httpUrl: RPC_URL },
    fallback: providerUrls.fallbackRpcUrl ? { name: 'fallback-rpc', httpUrl: providerUrls.fallbackRpcUrl } : undefined,
    cooldownMs: 60_000,
    onFailover: (from, to, reason) => logger.warn(`Gateway RPC failover ${from} -> ${to}: ${reason}`),
  });
  provider = resilientProvider.getRawProvider();
  wallet = createWalletIfValid(PRIVATE_KEY, provider) as ethers.Wallet | null;
  if (!wallet) throw new Error('PRIVATE_KEY invalid or not configured for AgentPaymentGateway service');
  contract = new ethers.Contract(AGENT_GATEWAY_ADDRESS, GATEWAY_ABI, wallet);
  logger.info('Initialized AgentPaymentGateway service', { gateway: AGENT_GATEWAY_ADDRESS, signer: (wallet as any).address });
}

export async function payAgentInKES(agentId: string, kesAmount: number | bigint | string, payer: string, mpesaTxHash: string, confirmations = 1) {
  init();
  if (!contract || !wallet) throw new Error('Gateway not initialized');

  // Normalize agentId: expect 0x-prefixed bytes32; otherwise keccak256 the input
  let agentIdBytes = agentId;
  if (!agentId.startsWith('0x')) {
    agentIdBytes = ethers.id(agentId); // keccak256 of utf8
  }

  const kesInt = BigInt(Math.round(Number(kesAmount)));

  try {
    const tx = await resilientProvider!.call(async (providerForCall) => {
    const walletForCall = createWalletIfValid(PRIVATE_KEY, providerForCall) as ethers.Wallet | null;
    if (!walletForCall) throw new Error('PRIVATE_KEY invalid or not configured for AgentPaymentGateway service');
    const contractForCall = new ethers.Contract(AGENT_GATEWAY_ADDRESS, GATEWAY_ABI, walletForCall);
    return contractForCall.payAgentInKES(agentIdBytes, kesInt, payer, mpesaTxHash);
  });
    logger.info('Sent payAgentInKES tx', { hash: tx.hash });
    if (confirmations > 0) {
      try {
        await resilientProvider!.call((providerForCall) =>
          providerForCall.waitForTransaction(tx.hash, confirmations, 120_000)
        );
      } catch (waitErr) {
        logger.warn('Waiting for confirmations timed out', { txHash: tx.hash, err: String(waitErr) });
      }
    }
    return tx;
  } catch (err: any) {
    logger.error('payAgentInKES failed', { error: err?.message || String(err) });
    throw err;
  }
}

export async function configureAgent(
  agentId: string,
  agentAddress: string,
  feeInKES: number | string,
  feeInUSD: number | string,
  defaultTier: number | string,
  defaultSubscriptionDuration: number | string,
  payoutPercentage: number,
  treasuryPercentage: number | string,
  communityPercentage: number | string,
  acceptsMTAA = true,
  acceptsKES = true
) {
  init();
  if (!contract) throw new Error('Gateway not initialized');

  let agentIdBytes = agentId;
  if (!agentId.startsWith('0x')) agentIdBytes = ethers.id(agentId);

  const feeInKESBig = BigInt(String(feeInKES || 0));
  const feeInUSDBig = BigInt(String(feeInUSD || 0));
  const defaultTierNum = Number(defaultTier || 0);
  const defaultSubscriptionDurationBig = BigInt(String(defaultSubscriptionDuration || 0));
  const payoutPercentageNum = Number(payoutPercentage || 0);
  const treasuryPercentageBig = BigInt(String(treasuryPercentage || 0));
  const communityPercentageBig = BigInt(String(communityPercentage || 0));

  const tx = await resilientProvider!.call(async (providerForCall) => {
    const walletForCall = createWalletIfValid(PRIVATE_KEY, providerForCall) as ethers.Wallet | null;
    if (!walletForCall) throw new Error('PRIVATE_KEY invalid or not configured for AgentPaymentGateway service');
    const contractForCall = new ethers.Contract(AGENT_GATEWAY_ADDRESS, GATEWAY_ABI, walletForCall);
    return contractForCall.configureAgent(
    agentIdBytes,
    agentAddress,
    feeInKESBig,
    feeInUSDBig,
    defaultTierNum,
    defaultSubscriptionDurationBig,
    payoutPercentageNum,
    treasuryPercentageBig,
    communityPercentageBig,
      acceptsMTAA,
      acceptsKES
    );
  });

  logger.info('Sent configureAgent tx', { hash: tx.hash });
  return tx;
}

export default { payAgentInKES, configureAgent };
