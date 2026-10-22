import fs from 'fs';
import path from 'path';
import { ethers } from 'ethers';
import { createWalletIfValid } from '../utils/cryptoWallet';
import { resolveProviderUrls } from './providerBootstrap';
import { ResilientRpcProvider } from './resilientRpcProvider';

const providerUrls = resolveProviderUrls();
const RPC_URL = providerUrls.rpcUrl;
const PRIVATE_KEY = process.env.ROTATION_SIGNER_PRIVATE_KEY || '';
const ROTATION_MODULE_ADDRESS = process.env.ROTATION_MODULE_ADDRESS || '';

export interface RotationContractDependencies {
  createWallet?: (privateKey: string, provider: ethers.Provider) => ethers.Wallet | undefined;
  createContract?: (address: string, abi: any[], signer: ethers.Signer) => any;
  createResilientProvider?: (providerUrl: string) => { call: (callback: (provider: ethers.Provider) => Promise<any>) => Promise<any> };
}

export interface RotationInitialization {
  vaultAddress: string;
  memberIds: string[];
  memberAddresses: string[];
  monthlyContribution: bigint | string | number;
  selectionMethod: number;
  minimumParticipationBps: bigint | string | number;
  chamaTreasury: string;
  stablecoin: string;
}

function loadAbi() {
  const abiPath = path.resolve(__dirname, '..', '..', 'artifacts', 'contracts', 'RotationModule.sol', 'RotationModule.json');
  const json = JSON.parse(fs.readFileSync(abiPath, 'utf8'));
  return json.abi;
}

async function withRotationContract<T>(
  deps: RotationContractDependencies | undefined,
  callback: (contract: any) => Promise<T>
): Promise<T> {
  if (!ROTATION_MODULE_ADDRESS) throw new Error('ROTATION_MODULE_ADDRESS not configured');
  if (!PRIVATE_KEY) throw new Error('ROTATION_SIGNER_PRIVATE_KEY not configured');

  const resilientProvider = deps?.createResilientProvider
    ? deps.createResilientProvider(RPC_URL)
    : new ResilientRpcProvider({
        primary: { name: 'primary-rpc', httpUrl: RPC_URL },
        fallback: providerUrls.fallbackRpcUrl ? { name: 'fallback-rpc', httpUrl: providerUrls.fallbackRpcUrl } : undefined,
        cooldownMs: 60_000,
      });

  return resilientProvider.call(async (provider) => {
    const signer = deps?.createWallet
      ? deps.createWallet(PRIVATE_KEY, provider)
      : createWalletIfValid(PRIVATE_KEY, provider);
    if (!signer) throw new Error('ROTATION_SIGNER_PRIVATE_KEY configured with an invalid key');
    const abi = loadAbi();
    const contractFactory = deps?.createContract ?? ((address: string, abiDefinition: any[], signerInstance: ethers.Signer) => new ethers.Contract(address, abiDefinition, signerInstance));
    return callback(contractFactory(ROTATION_MODULE_ADDRESS, abi, signer));
  });
}

export async function initializeRotationOnChain(
  initialization: RotationInitialization,
  deps?: RotationContractDependencies
) {
  return withRotationContract(deps, async (contract) => {
    const tx = await contract.initializeRotation(
      initialization.vaultAddress,
      initialization.memberIds,
      initialization.memberAddresses,
      initialization.monthlyContribution,
      initialization.selectionMethod,
      initialization.minimumParticipationBps,
      initialization.chamaTreasury,
      initialization.stablecoin
    );
    return tx.wait();
  });
}

export async function getRotationConfigOnChain(vaultAddress: string) {
  if (!ROTATION_MODULE_ADDRESS) throw new Error('ROTATION_MODULE_ADDRESS not configured');

  const resilientProvider = new ResilientRpcProvider({
    primary: { name: 'primary-rpc', httpUrl: RPC_URL },
    fallback: providerUrls.fallbackRpcUrl ? { name: 'fallback-rpc', httpUrl: providerUrls.fallbackRpcUrl } : undefined,
    cooldownMs: 60_000,
  });
  return resilientProvider.call(async (provider) => {
    const contract = new ethers.Contract(ROTATION_MODULE_ADDRESS, loadAbi(), provider);
    return contract.getRotationConfig(vaultAddress);
  });
}

export async function getStablecoinDecimals(stablecoinAddress: string): Promise<number> {
  const resilientProvider = new ResilientRpcProvider({
    primary: { name: 'primary-rpc', httpUrl: RPC_URL },
    fallback: providerUrls.fallbackRpcUrl ? { name: 'fallback-rpc', httpUrl: providerUrls.fallbackRpcUrl } : undefined,
    cooldownMs: 60_000,
  });
  return resilientProvider.call(async (provider) => {
    const token = new ethers.Contract(
      stablecoinAddress,
      ['function decimals() view returns (uint8)'],
      provider
    );
    return Number(await token.decimals());
  });
}

export async function getStablecoinSymbol(stablecoinAddress: string): Promise<string> {
  const resilientProvider = new ResilientRpcProvider({
    primary: { name: 'primary-rpc', httpUrl: RPC_URL },
    fallback: providerUrls.fallbackRpcUrl ? { name: 'fallback-rpc', httpUrl: providerUrls.fallbackRpcUrl } : undefined,
    cooldownMs: 60_000,
  });
  return resilientProvider.call(async (provider) => {
    const token = new ethers.Contract(
      stablecoinAddress,
      ['function symbol() view returns (string)'],
      provider
    );
    return String(await token.symbol());
  });
}

export async function getRotationMemberAddress(vaultAddress: string, memberId: string): Promise<string> {
  if (!ROTATION_MODULE_ADDRESS) throw new Error('ROTATION_MODULE_ADDRESS not configured');
  const resilientProvider = new ResilientRpcProvider({
    primary: { name: 'primary-rpc', httpUrl: RPC_URL },
    fallback: providerUrls.fallbackRpcUrl ? { name: 'fallback-rpc', httpUrl: providerUrls.fallbackRpcUrl } : undefined,
    cooldownMs: 60_000,
  });
  return resilientProvider.call(async (provider) => {
    const contract = new ethers.Contract(ROTATION_MODULE_ADDRESS, loadAbi(), provider);
    return String(await contract.memberAddress(vaultAddress, memberId));
  });
}

export async function getCurrentRotationCycleOnChain(vaultAddress: string) {
  if (!ROTATION_MODULE_ADDRESS) throw new Error('ROTATION_MODULE_ADDRESS not configured');
  const resilientProvider = new ResilientRpcProvider({
    primary: { name: 'primary-rpc', httpUrl: RPC_URL },
    fallback: providerUrls.fallbackRpcUrl ? { name: 'fallback-rpc', httpUrl: providerUrls.fallbackRpcUrl } : undefined,
    cooldownMs: 60_000,
  });
  return resilientProvider.call(async (provider) => {
    const contract = new ethers.Contract(ROTATION_MODULE_ADDRESS, loadAbi(), provider);
    return contract.getCurrentCycle(vaultAddress);
  });
}

export async function inspectRotationContribution(vaultAddress: string, memberId: string) {
  if (!ROTATION_MODULE_ADDRESS) throw new Error('ROTATION_MODULE_ADDRESS not configured');
  const resilientProvider = new ResilientRpcProvider({
    primary: { name: 'primary-rpc', httpUrl: RPC_URL },
    fallback: providerUrls.fallbackRpcUrl ? { name: 'fallback-rpc', httpUrl: providerUrls.fallbackRpcUrl } : undefined,
    cooldownMs: 60_000,
  });
  return resilientProvider.call(async (provider) => {
    const contract = new ethers.Contract(ROTATION_MODULE_ADDRESS, loadAbi(), provider);
    const [config, cycle, hasPaid] = await Promise.all([
      contract.getRotationConfig(vaultAddress),
      contract.getCurrentCycle(vaultAddress),
      contract.hasMemberPaid(vaultAddress, memberId),
    ]);
    return {
      totalMembers: Number(config.totalMembers),
      monthlyContribution: BigInt(config.monthlyContribution),
      stablecoin: String(config.stablecoin),
      cycleNumber: Number(cycle.cycleNumber),
      cycleStartTimestamp: Number(cycle.nextDistributionDate) - 30 * 24 * 60 * 60,
      hasPaid: Boolean(hasPaid),
    };
  });
}

export async function verifyStablecoinTransfer(input: {
  transactionHash: string;
  stablecoin: string;
  sender: string;
  recipient: string;
  amount?: bigint;
  notBeforeTimestamp: number;
}) {
  const resilientProvider = new ResilientRpcProvider({
    primary: { name: 'primary-rpc', httpUrl: RPC_URL },
    fallback: providerUrls.fallbackRpcUrl ? { name: 'fallback-rpc', httpUrl: providerUrls.fallbackRpcUrl } : undefined,
    cooldownMs: 60_000,
  });
  return resilientProvider.call(async (provider) => {
    const receipt = await provider.getTransactionReceipt(input.transactionHash);
    if (!receipt || receipt.status !== 1) throw new Error('Stablecoin deposit transaction is not confirmed successfully');

    const block = await provider.getBlock(receipt.blockNumber);
    if (!block || block.timestamp < input.notBeforeTimestamp) {
      throw new Error('Stablecoin deposit transaction predates the current rotation cycle');
    }

    const transferInterface = new ethers.Interface([
      'event Transfer(address indexed from, address indexed to, uint256 value)',
    ]);
    const matches = receipt.logs.flatMap((log) => {
      if (log.address.toLowerCase() !== input.stablecoin.toLowerCase()) return [];
      try {
        const parsed = transferInterface.parseLog(log);
        if (!parsed ||
            String(parsed.args.from).toLowerCase() !== input.sender.toLowerCase() ||
            String(parsed.args.to).toLowerCase() !== input.recipient.toLowerCase() ||
            (input.amount !== undefined && BigInt(parsed.args.value) !== input.amount)) {
          return [];
        }
        return [{ logIndex: log.index, amount: BigInt(parsed.args.value) }];
      } catch {
        return [];
      }
    });
    if (matches.length !== 1) {
      throw new Error('Transaction must contain exactly one matching stablecoin transfer between the specified addresses');
    }
    const [network, currentBlockNumber] = await Promise.all([
      provider.getNetwork(),
      provider.getBlockNumber(),
    ]);
    return {
      blockNumber: receipt.blockNumber,
      blockTimestamp: block.timestamp,
      chainId: Number(network.chainId),
      confirmations: Math.max(0, currentBlockNumber - receipt.blockNumber + 1),
      logIndex: matches[0].logIndex,
      amount: matches[0].amount,
    };
  });
}

export async function recordContributionOnChain(
  vaultAddress: string,
  memberId: string,
  amount: bigint | string | number,
  deps?: RotationContractDependencies
) {
  return withRotationContract(deps, async (contract) => {
    const tx = await contract.recordContribution(vaultAddress, memberId, amount);
    return tx.wait();
  });
}

export async function distributeToRecipientOnChain(vaultAddress: string, deps?: RotationContractDependencies) {
  const result = await withRotationContract(deps, async (contract) => {
    const tx = await contract.distributeToRecipient(vaultAddress);
    const receipt = await tx.wait();
    return { txHash: receipt.transactionHash, blockNumber: receipt.blockNumber };
  });

  return result;
}

export function getRotationAbi() {
  return loadAbi();
}
