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
