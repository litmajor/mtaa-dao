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

function loadAbi() {
  const abiPath = path.resolve(__dirname, '..', '..', 'artifacts', 'contracts', 'RotationModule.sol', 'RotationModule.json');
  const json = JSON.parse(fs.readFileSync(abiPath, 'utf8'));
  return json.abi;
}

export async function distributeToRecipientOnChain(vaultAddress: string, deps?: RotationContractDependencies) {
  if (!ROTATION_MODULE_ADDRESS) throw new Error('ROTATION_MODULE_ADDRESS not configured');
  if (!PRIVATE_KEY) throw new Error('ROTATION_SIGNER_PRIVATE_KEY not configured');

  const resilientProvider = deps?.createResilientProvider
    ? deps.createResilientProvider(RPC_URL)
    : new ResilientRpcProvider({
        primary: { name: 'primary-rpc', httpUrl: RPC_URL },
        fallback: providerUrls.fallbackRpcUrl ? { name: 'fallback-rpc', httpUrl: providerUrls.fallbackRpcUrl } : undefined,
        cooldownMs: 60_000,
      });

  const result = await resilientProvider.call(async (provider) => {
    const signer = deps?.createWallet
      ? deps.createWallet(PRIVATE_KEY, provider)
      : createWalletIfValid(PRIVATE_KEY, provider);
    if (!signer) throw new Error('ROTATION_SIGNER_PRIVATE_KEY not configured or invalid');

    const abi = loadAbi();
    const contractFactory = deps?.createContract ?? ((address: string, abiDefinition: any[], signerInstance: ethers.Signer) => new ethers.Contract(address, abiDefinition, signerInstance));
    const contract = contractFactory(ROTATION_MODULE_ADDRESS, abi, signer);

    const tx = await contract.distributeToRecipient(vaultAddress);
    const receipt = await tx.wait();
    return { txHash: receipt.transactionHash, blockNumber: receipt.blockNumber };
  });

  return result;
}

export function getRotationAbi() {
  return loadAbi();
}
