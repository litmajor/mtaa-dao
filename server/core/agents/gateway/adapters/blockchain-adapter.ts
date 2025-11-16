/**
 * Blockchain RPC Adapter
 * Direct blockchain data source for wallet balances, transactions, and chain state
 * Priority: 6 (On-chain verification, highest authority)
 */

import { BaseAdapter } from "./base-adapter";
import { AdapterResponse, NormalizedData, BaseAdapterConfig } from "../types";

export interface RpcProvider {
  celo: string;
  ethereum?: string;
  polygon?: string;
  arbitrum?: string;
}

export class BlockchainAdapter extends BaseAdapter {
  private rpcProviders: RpcProvider;

  constructor(config: BaseAdapterConfig) {
    super("blockchain", config);
    this.rpcProviders = {
      celo: config.rpcUrl || process.env.CELO_RPC_URL || "https://forno.celo.org",
      ethereum:
        process.env.ETHEREUM_RPC_URL || "https://eth.publicnode.com",
      polygon:
        process.env.POLYGON_RPC_URL || "https://polygon-rpc.com",
      arbitrum:
        process.env.ARBITRUM_RPC_URL || "https://arb1.arbitrum.io/rpc",
    };
  }

  async fetch(
    dataType: string,
    params: any
  ): Promise<AdapterResponse<NormalizedData | NormalizedData[]>> {
    const startTime = Date.now();

    try {
      if (dataType === "balance") {
        return await this.fetchBalance(params);
      } else if (dataType === "price") {
        return await this.fetchOnChainPrice(params);
      } else if (dataType === "transaction") {
        return await this.fetchTransaction(params);
      }

      return {
        success: false,
        error: `Unsupported data type: ${dataType}`,
        timestamp: new Date(),
        latencyMs: Date.now() - startTime,
      };
    } catch (error) {
      return {
        success: false,
        error: (error as Error).message,
        timestamp: new Date(),
        latencyMs: Date.now() - startTime,
      };
    }
  }

  private async fetchBalance(params: any): Promise<AdapterResponse<NormalizedData>> {
    const startTime = Date.now();
    const { address, chain = "celo", tokenAddress } = params;

    if (!address) {
      return {
        success: false,
        error: "Address parameter required",
        timestamp: new Date(),
        latencyMs: Date.now() - startTime,
      };
    }

    const cacheKey = `blockchain:balance:${chain}:${address}:${tokenAddress || "native"}`;
    const cached = this.getCache(cacheKey);
    if (cached) {
      return {
        success: true,
        data: cached,
        timestamp: new Date(),
        latencyMs: Date.now() - startTime,
      };
    }

    try {
      const rpcUrl = this.getRpcUrl(chain);
      let balance;

      if (tokenAddress) {
        // ERC20 token balance
        const balanceOfSignature = "0x70a08231"; // balanceOf(address)
        const paddedAddress = this.padAddress(address);

        const result = await this.callRpc(rpcUrl, "eth_call", [
          {
            to: tokenAddress,
            data: balanceOfSignature + paddedAddress.slice(2),
          },
          "latest",
        ]);

        balance = BigInt(result).toString();
      } else {
        // Native token balance
        const result = await this.callRpc(rpcUrl, "eth_getBalance", [
          address,
          "latest",
        ]);
        balance = BigInt(result).toString();
      }

      const data: NormalizedData = {
        id: `blockchain:${chain}:balance:${address}:${Date.now()}`,
        source: "blockchain",
        timestamp: new Date().toISOString(),
        dataType: "balance",
        asset: {
          symbol: tokenAddress ? "ERC20" : chain.toUpperCase(),
          chain,
          address: tokenAddress || "native",
        },
        value: parseInt(balance),
        metadata: {
          confidence: 0.99, // On-chain data is authoritative
          walletAddress: address,
          tokenAddress: tokenAddress || "native",
          rpcProvider: rpcUrl,
        },
      };

      this.setCache(cacheKey, data, 120); // Cache for 2 minutes

      return {
        success: true,
        data,
        timestamp: new Date(),
        latencyMs: Date.now() - startTime,
      };
    } catch (error) {
      return {
        success: false,
        error: (error as Error).message,
        timestamp: new Date(),
        latencyMs: Date.now() - startTime,
      };
    }
  }

  private async fetchOnChainPrice(
    params: any
  ): Promise<AdapterResponse<NormalizedData>> {
    const startTime = Date.now();
    const { token0, token1, chain = "celo", poolAddress } = params;

    if (!poolAddress) {
      return {
        success: false,
        error: "Pool address required for on-chain price",
        timestamp: new Date(),
        latencyMs: Date.now() - startTime,
      };
    }

    const cacheKey = `blockchain:price:${chain}:${poolAddress}:${token0}:${token1}`;
    const cached = this.getCache(cacheKey);
    if (cached) {
      return {
        success: true,
        data: cached,
        timestamp: new Date(),
        latencyMs: Date.now() - startTime,
      };
    }

    try {
      const rpcUrl = this.getRpcUrl(chain);

      // Uniswap V3 slot0 call for price data
      const slot0Signature = "0x3850c7bd"; // slot0()

      const result = await this.callRpc(rpcUrl, "eth_call", [
        {
          to: poolAddress,
          data: slot0Signature,
        },
        "latest",
      ]);

      // Decode sqrtPriceX96 from slot0 response
      const sqrtPrice = "0x" + result.slice(66, 130);
      const sqrtPriceValue = BigInt(sqrtPrice);

      // Calculate price from sqrtPriceX96
      const price =
        (Number(sqrtPriceValue) ** 2) / 2 ** 192;

      const data: NormalizedData = {
        id: `blockchain:${chain}:price:${poolAddress}:${Date.now()}`,
        source: "blockchain",
        timestamp: new Date().toISOString(),
        dataType: "price",
        asset: {
          symbol: `${token0}/${token1}`,
          chain,
          address: poolAddress,
        },
        value: price,
        metadata: {
          confidence: 0.95,
          token0,
          token1,
          poolAddress,
          sqrtPriceX96: sqrtPrice,
          rpcProvider: rpcUrl,
        },
      };

      this.setCache(cacheKey, data, 30); // Cache for 30 seconds (volatile)

      return {
        success: true,
        data,
        timestamp: new Date(),
        latencyMs: Date.now() - startTime,
      };
    } catch (error) {
      return {
        success: false,
        error: (error as Error).message,
        timestamp: new Date(),
        latencyMs: Date.now() - startTime,
      };
    }
  }

  private async fetchTransaction(
    params: any
  ): Promise<AdapterResponse<NormalizedData>> {
    const startTime = Date.now();
    const { txHash, chain = "celo" } = params;

    if (!txHash) {
      return {
        success: false,
        error: "Transaction hash required",
        timestamp: new Date(),
        latencyMs: Date.now() - startTime,
      };
    }

    try {
      const rpcUrl = this.getRpcUrl(chain);

      const txData = await this.callRpc(rpcUrl, "eth_getTransactionByHash", [
        txHash,
      ]);

      const receipt = await this.callRpc(
        rpcUrl,
        "eth_getTransactionReceipt",
        [txHash]
      );

      const data: NormalizedData = {
        id: `blockchain:${chain}:tx:${txHash}:${Date.now()}`,
        source: "blockchain",
        timestamp: new Date().toISOString(),
        dataType: "transaction",
        asset: {
          symbol: "TRANSACTION",
          chain,
          address: txHash,
        },
        value: BigInt(txData.value).toString(), // Value transferred
        metadata: {
          confidence: 0.99,
          txHash,
          from: txData.from,
          to: txData.to,
          blockNumber: txData.blockNumber,
          gasUsed: receipt ? BigInt(receipt.gasUsed).toString() : undefined,
          status: receipt ? receipt.status === "0x1" : undefined,
          rpcProvider: rpcUrl,
        },
      };

      return {
        success: true,
        data,
        timestamp: new Date(),
        latencyMs: Date.now() - startTime,
      };
    } catch (error) {
      return {
        success: false,
        error: (error as Error).message,
        timestamp: new Date(),
        latencyMs: Date.now() - startTime,
      };
    }
  }

  private async callRpc(
    rpcUrl: string,
    method: string,
    params: any[]
  ): Promise<any> {
    const response = await this.makeRequest<any>(rpcUrl, {
      method: "POST",
      body: JSON.stringify({
        jsonrpc: "2.0",
        method,
        params,
        id: Date.now(),
      }),
      headers: { "Content-Type": "application/json" },
    });

    if (response.error) {
      throw new Error(`RPC Error: ${response.error.message}`);
    }

    return response.result;
  }

  private getRpcUrl(chain: string): string {
    const url = this.rpcProviders[chain as keyof RpcProvider];
    if (!url) {
      throw new Error(`Unsupported chain: ${chain}`);
    }
    return url;
  }

  private padAddress(address: string): string {
    const cleanAddress = address.replace("0x", "");
    return "0x" + cleanAddress.padStart(64, "0");
  }
}
