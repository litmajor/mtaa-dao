/**
 * Exchange Manager
 * Manages connections to multiple exchanges
 */

import { BinanceConnector } from './binance';
import { ExchangeConnector, ExchangeConfig } from './types';

export class ExchangeManager {
  private connectors: Map<string, ExchangeConnector> = new Map();
  private credentials: Map<string, ExchangeConfig> = new Map();

  /**
   * Initialize exchange connector
   */
  async initializeExchange(config: ExchangeConfig): Promise<ExchangeConnector> {
    try {
      let connector: ExchangeConnector;

      switch (config.name.toLowerCase()) {
        case 'binance':
          connector = new BinanceConnector(
            config.credentials.apiKey,
            config.credentials.apiSecret,
            config.sandbox
          );
          break;
        case 'kraken':
          // TODO: Implement KrakenConnector
          throw new Error('Kraken not yet implemented');
        case 'coinbase':
          // TODO: Implement CoinbaseConnector
          throw new Error('Coinbase not yet implemented');
        default:
          throw new Error(`Unknown exchange: ${config.name}`);
      }

      await connector.connect();
      this.connectors.set(config.name, connector);
      this.credentials.set(config.name, config);

      return connector;
    } catch (error) {
      throw new Error(
        `Failed to initialize ${config.name}: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Get connector for exchange
   */
  getConnector(exchangeName: string): ExchangeConnector {
    const connector = this.connectors.get(exchangeName);
    if (!connector) {
      throw new Error(`Exchange not initialized: ${exchangeName}`);
    }
    return connector;
  }

  /**
   * Get all initialized exchanges
   */
  getInitializedExchanges(): string[] {
    return Array.from(this.connectors.keys());
  }

  /**
   * Check if exchange is connected
   */
  isExchangeConnected(exchangeName: string): boolean {
    const connector = this.connectors.get(exchangeName);
    return connector ? connector.isConnected() : false;
  }

  /**
   * Disconnect all exchanges
   */
  async disconnectAll(): Promise<void> {
    for (const connector of this.connectors.values()) {
      await connector.disconnect();
    }
    this.connectors.clear();
  }

  /**
   * Disconnect specific exchange
   */
  async disconnect(exchangeName: string): Promise<void> {
    const connector = this.connectors.get(exchangeName);
    if (connector) {
      await connector.disconnect();
      this.connectors.delete(exchangeName);
    }
  }
}

// Singleton instance
export const exchangeManager = new ExchangeManager();
