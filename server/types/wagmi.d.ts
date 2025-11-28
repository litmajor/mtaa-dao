/**
 * Type declarations for wagmi
 * Provides type definitions for wagmi library when @types/wagmi is not available
 */

declare module 'wagmi' {
  export interface Config {
    [key: string]: any;
  }

  export interface UseAccountReturnType {
    address?: `0x${string}`;
    isConnected: boolean;
    isDisconnected: boolean;
    isConnecting: boolean;
    isReconnecting: boolean;
    status: 'connected' | 'disconnected' | 'connecting' | 'reconnecting';
    chain?: any;
    chainId?: number;
  }

  export interface UseReadContractReturnType {
    data?: any;
    error?: Error | null;
    isPending: boolean;
    isLoading?: boolean;
    isSuccess: boolean;
    isError: boolean;
    status: 'idle' | 'pending' | 'success' | 'error';
  }

  export interface UseWriteContractReturnType {
    write?: (...args: any[]) => void;
    writeAsync?: (...args: any[]) => Promise<any>;
    data?: any;
    error?: Error | null;
    isPending: boolean;
    isLoading?: boolean;
    isSuccess: boolean;
    isError: boolean;
    status: 'idle' | 'pending' | 'success' | 'error';
  }

  export interface UseContractReturnType {
    address: `0x${string}`;
    abi: readonly any[];
    functionName: string;
    args?: readonly any[];
    account?: `0x${string}`;
    chainId?: number;
  }

  export function useAccount(): UseAccountReturnType;
  export function useReadContract(config: any): UseReadContractReturnType;
  export function useWriteContract(config: any): UseWriteContractReturnType;
  export function useConnect(): any;
  export function useDisconnect(): any;
  export function useChainId(): number;
  export function useNetwork(): any;
  export function useSwitchChain(): any;
  export function useSwitchNetwork(): any;
  export function useBalance(config: any): any;
  export function useBlockNumber(config: any): any;
  export function useContractRead(config: any): UseReadContractReturnType;
  export function useContractWrite(config: any): UseWriteContractReturnType;
  export function useContractEvent(config: any): any;

  export function createConfig(config: any): Config;
  export function getConfig(): Config;
  export function getAccount(): UseAccountReturnType;
}

declare module 'wagmi/chains' {
  export const mainnet: any;
  export const sepolia: any;
  export const polygon: any;
  export const polygonMumbai: any;
  export const celo: any;
  export const celoAlfajores: any;
  export const arbitrum: any;
  export const arbitrumGoerli: any;
  export const optimism: any;
  export const optimismGoerli: any;
  export const base: any;
  export const baseGoerli: any;
}

declare module 'wagmi/connectors' {
  export class InjectedConnector {
    constructor(config?: any);
  }
  export class WalletConnectConnector {
    constructor(config?: any);
  }
  export class CoinbaseWalletConnector {
    constructor(config?: any);
  }
}
