/**
 * PAYMENT GATEWAY SERVICE
 * Resilient multi-provider payment orchestration core engine including Kotani Pay
 */

import { db } from '../storage';
import { paymentTransactions, users } from '../../shared/schema';
import { eq } from 'drizzle-orm';
import { logger } from '../utils/logger';
import {
  PaymentError,
  PaymentErrorHandler,
  PaymentErrorCode,
  PaymentValidator
} from './paymentErrorHandler';
import {
  RetryService,
  DEFAULT_RETRY_POLICIES
} from './retryService';
import { PaymentErrorMonitoringService } from './paymentErrorMonitoringService';
import { distributedLockManager, idempotencyManager } from './concurrencyControl';

export interface PaymentGatewayConfig {
  provider: 'flutterwave' | 'paystack' | 'mpesa' | 'mtn' | 'airtel' | 'stripe' | 'kotanipay';
  apiKey: string;
  secretKey: string;
  webhookSecret?: string;
  environment: 'test' | 'production';
}

export interface PaymentRequest {
  userId: string;
  amount: string;
  currency: string;
  method: 'card' | 'mobile_money' | 'bank_transfer';
  metadata?: Record<string, any>;
  callbackUrl?: string;
}

export interface PaymentResponse {
  success: boolean;
  transactionId: string;
  paymentUrl?: string;
  reference: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  message?: string;
}

interface MpesaTokenCache {
  token: string;
  expiryTime: number;
}

export class PaymentGatewayService {
  private configs: Map<string, PaymentGatewayConfig> = new Map();
  private mpesaTokenCache: MpesaTokenCache | null = null;
  private mpesaTokenPromise: Promise<string> | null = null;

  constructor() {
    this.initializeProviders();
  }

  private initializeProviders() {
    // FIX: Appended kotanipay directly into the service environment validation block
    const environments = ['flutterwave', 'paystack', 'mpesa', 'mtn', 'airtel', 'stripe', 'kotanipay'] as const;
    
    for (const provider of environments) {
      const upper = provider.toUpperCase();
      const pubKey = process.env[`${upper}_PUBLIC_KEY`] || process.env[`${upper}_CONSUMER_KEY`];
      const secKey = process.env[`${upper}_SECRET_KEY`] || process.env[`${upper}_CONSUMER_SECRET`];

      if (pubKey && secKey) {
        this.configs.set(provider, {
          provider,
          apiKey: pubKey,
          secretKey: secKey,
          webhookSecret: process.env[`${upper}_WEBHOOK_SECRET`],
          environment: (process.env[`${upper}_ENV`] as any) || 'test'
        });
      }
    }
  }

  /**
   * Universal Resilient Fetch Wrapper protecting system threads against hanging gateway sockets
   */
  private async requestWithTimeout(url: string, options: RequestInit, timeoutMs = 25000): Promise<Response> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(url, { ...options, signal: controller.signal });
      clearTimeout(timeoutId);
      return response;
    } catch (error: any) {
      clearTimeout(timeoutId);
      if (error.name === 'AbortError') {
        throw new Error(`Gateway connection timed out after exceeding ${timeoutMs}ms limit.`);
      }
      throw error;
    }
  }

  async initiateDeposit(provider: string, request: PaymentRequest & { idempotencyKey?: string }): Promise<PaymentResponse | ReturnType<typeof PaymentErrorHandler.toResponse>> {
    const validProvider = PaymentValidator.validateProvider(provider);
    const validAmount = PaymentValidator.validateAmount(request.amount);
    const validUserId = PaymentValidator.validateUserId(request.userId);
    const validCurrency = PaymentValidator.validateCurrency(request.currency);

    const phoneFingerprint = request.metadata?.phone ? `:${request.metadata.phone.replace(/\D/g, '').slice(-9)}` : '';
    const idempotencyKey = request.idempotencyKey || `deposit:${validUserId}:${validAmount}:${validCurrency}${phoneFingerprint}`;
    
    try {
      const cachedResult = await idempotencyManager.getResult(idempotencyKey);
      if (cachedResult) {
        logger.info(`[IDEMPOTENCY CACHE HIT] Deposit processed for user ${validUserId}`, { idempotencyKey });
        return cachedResult as PaymentResponse;
      }

      const config = this.configs.get(validProvider);
      if (!config) {
        throw PaymentErrorHandler.createError(
          PaymentErrorCode.PROVIDER_NOT_CONFIGURED,
          `Payment provider ${validProvider} configuration missing.`,
          { provider: validProvider }
        );
      }

      const limits = await this.getTransactionLimits(validUserId);
      if (validAmount > limits.dailyLimit) {
        throw PaymentErrorHandler.createError(
          PaymentErrorCode.DAILY_LIMIT_EXCEEDED,
          `Transaction exceeds verification daily limit of ${limits.dailyLimit} ${validCurrency}`,
          { amount: validAmount, limit: limits.dailyLimit, currency: validCurrency, tier: limits.tier }
        );
      }

      const validatedRequest = {
        ...request,
        userId: validUserId,
        amount: validAmount.toString(),
        currency: validCurrency
      };

      const result = await RetryService.executeWithRetryAndTimeout(
        () => this.executeDeposit(validProvider, config, validatedRequest),
        DEFAULT_RETRY_POLICIES.provider,
        30000,
        { provider: validProvider, userId: validUserId }
      );

      await idempotencyManager.recordResult(idempotencyKey, result, 3600);
      return result;

    } catch (error: any) {
      const category = error instanceof PaymentError ? 'validation' : 'provider';
      const normalizedError = error instanceof PaymentError 
        ? error 
        : PaymentErrorHandler.handleProviderError(validProvider, error, { operation: 'initiateDeposit' });

      logger.error('Deposit initiation workflow aborted', {
        code: normalizedError.code,
        message: normalizedError.message,
        provider: validProvider
      });

      try {
        PaymentErrorMonitoringService.recordError({
          timestamp: new Date(),
          errorCode: normalizedError.code,
          errorCategory: category,
          provider: validProvider,
          operation: 'deposit',
          userId: validUserId,
          count: 1,
          retryCount: 0,
          statusCode: normalizedError.statusCode,
          message: normalizedError.message,
          context: normalizedError.metadata,
        });
      } catch (monitorErr) {
        logger.error('Telemetry logging failed alongside active gateway error resolution.', { monitorErr });
      }

      return PaymentErrorHandler.toResponse(normalizedError);
    }
  }

  private async executeDeposit(
    provider: string,
    config: PaymentGatewayConfig,
    request: PaymentRequest
  ): Promise<PaymentResponse> {
    switch (provider) {
      case 'flutterwave': return this.flutterwaveDeposit(config, request);
      case 'paystack': return this.paystackDeposit(config, request);
      case 'mpesa': return this.mpesaDeposit(config, request);
      case 'kotanipay': return this.kotaniPayDeposit(config, request); // FIX: Exposed structural route
      default:
        throw PaymentErrorHandler.createError(
          PaymentErrorCode.INVALID_PROVIDER,
          `Provider operational channel [${provider}] is either unsupported or currently deactivated.`
        );
    }
  }

  /**
   * Enterprise M-Pesa Token Handler featuring atomic thread checks and an integrated TTL safety margin
   */
  private async getMpesaToken(config: PaymentGatewayConfig): Promise<string> {
    const bufferMarginMs = 5 * 60 * 1000; 
    const now = Date.now();

    if (this.mpesaTokenCache && this.mpesaTokenCache.expiryTime > now + bufferMarginMs) {
      return this.mpesaTokenCache.token;
    }

    if (this.mpesaTokenPromise) {
      return this.mpesaTokenPromise;
    }

    this.mpesaTokenPromise = (async () => {
      try {
        const auth = Buffer.from(`${config.apiKey}:${config.secretKey}`).toString('base64');
        const apiUrl = config.environment === 'production'
          ? 'https://api.safaricom.co.ke/oauth/v1/generate?grant_type=client_credentials'
          : 'https://sandbox.safaricom.co.ke/oauth/v1/generate?grant_type=client_credentials';

        const response = await this.requestWithTimeout(apiUrl, {
          method: 'GET',
          headers: { Authorization: `Basic ${auth}` }
        }, 10000);

        if (!response.ok) {
          throw new Error(`Safaricom Token Service returned status validation code: ${response.status}`);
        }

        const data = await response.json();
        if (!data.access_token || !data.expires_in) {
          throw new Error('Malformed token response footprint mapped from gateway authentication pipeline.');
        }

        this.mpesaTokenCache = {
          token: data.access_token,
          expiryTime: Date.now() + (parseInt(data.expires_in) * 1000)
        };

        return data.access_token;
      } finally {
        this.mpesaTokenPromise = null;
      }
    })();

    return this.mpesaTokenPromise;
  }

  /**
   * Production-Hardened Kotani Pay Fiat-to-Crypto Core Integration
   */
  private async kotaniPayDeposit(config: PaymentGatewayConfig, request: PaymentRequest): Promise<PaymentResponse> {
    const reference = `KOT-${Date.now()}-${Math.random().toString(36).substring(2, 11).toUpperCase()}`;
    
    try {
      const rawPhone = request.metadata?.phone?.replace(/\D/g, '');
      if (!rawPhone) {
        throw new Error('Kotani Pay mobile money payment demands an explicit MSISDN destination.');
      }

      // Kotani Pay crypto rails require explicit wallet target configurations to route digital assets safely
      const destinationWallet = request.metadata?.walletAddress || request.metadata?.publicKey;
      if (!destinationWallet) {
        throw new Error('Kotani Pay transactions require an explicit on-chain target wallet address execution path.');
      }

      const payload = {
        apiKey: config.apiKey,
        amount: parseFloat(request.amount),
        currency: request.currency,
        phoneNumber: rawPhone,
        network: request.metadata?.network || 'CELO', // e.g. CELO, POLYGON
        stablecoin: request.metadata?.stablecoin || 'cUSD', // e.g. cUSD, USDC
        walletAddress: destinationWallet,
        txRef: reference,
        callbackUrl: request.callbackUrl || `${process.env.APP_URL}/api/payment-gateway/kotanipay/callback`
      };

      const apiUrl = config.environment === 'production'
        ? 'https://api.kotanipay.com/v1/payments/deposit'
        : 'https://sandbox.kotanipay.com/v1/payments/deposit';

      const response = await this.requestWithTimeout(apiUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${config.secretKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });

      const data = await response.json();

      if (response.ok && (data.status === 'success' || data.status === 'pending')) {
        await this.recordTransaction(
          request.userId,
          reference,
          'deposit',
          request.amount,
          request.currency,
          'kotanipay',
          'pending',
          { id: data.id || data.transactionId, stablecoin: payload.stablecoin, wallet: destinationWallet }
        );

        return {
          success: true,
          transactionId: data.id || data.transactionId || reference,
          reference,
          status: 'pending',
          message: data.message || 'Kotani Pay off-ramp generation sequence initiated.'
        };
      }

      throw new Error(data.message || `Kotani Pay returned operational failure code: ${response.status}`);
    } catch (error: any) {
      try {
        await this.recordTransaction(request.userId, reference, 'deposit', request.amount, request.currency, 'kotanipay', 'failed', { error: error.message });
      } catch (dbLogErr) {
        logger.error('[CRITICAL LOSS OF STATE] Failed writing Kotani Pay breakdown log.', { dbLogErr, reference });
      }
      return { success: false, transactionId: '', reference, status: 'failed', message: error.message };
    }
  }

  private async mpesaDeposit(config: PaymentGatewayConfig, request: PaymentRequest): Promise<PaymentResponse> {
    const reference = `MPE-${Date.now()}-${Math.random().toString(36).substring(2, 11).toUpperCase()}`;
    
    try {
      const rawPhone = request.metadata?.phone?.replace(/\D/g, '');
      if (!rawPhone || rawPhone.length < 9) {
        throw new Error('STK push initialization requires a valid MSISDN compilation footprint.');
      }
      const formattedPhone = rawPhone.startsWith('254') ? rawPhone : `254${rawPhone.slice(-9)}`;

      const shortcode = process.env.MPESA_SHORTCODE;
      const passkey = process.env.MPESA_PASSKEY;
      if (!shortcode || !passkey) {
        throw new Error('Critical backend systemic failure: M-Pesa organizational parameters are unconfigured.');
      }

      const authToken = await this.getMpesaToken(config);
      const timestamp = new Date().toISOString().replace(/[^0-9]/g, '').slice(0, 14);
      const password = Buffer.from(`${shortcode}${passkey}${timestamp}`).toString('base64');

      const payload = {
        BusinessShortCode: shortcode,
        Password: password,
        Timestamp: timestamp,
        TransactionType: 'CustomerPayBillOnline',
        Amount: Math.round(parseFloat(request.amount)),
        PartyA: formattedPhone,
        PartyB: shortcode,
        PhoneNumber: formattedPhone,
        CallBackURL: `${process.env.APP_URL}/api/payment-gateway/mpesa/callback`,
        AccountReference: `MTAA-${request.userId.slice(0, 8).toUpperCase()}`,
        TransactionDesc: request.metadata?.description || 'DAO System Wallet Deposit Load'
      };

      const apiUrl = config.environment === 'production'
        ? 'https://api.safaricom.co.ke/mpesa/stkpush/v1/processrequest'
        : 'https://sandbox.safaricom.co.ke/mpesa/stkpush/v1/processrequest';

      const response = await this.requestWithTimeout(apiUrl, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${authToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });

      const data = await response.json();

      if (data.ResponseCode === '0') {
        await this.recordTransaction(
          request.userId, 
          reference, 
          'deposit', 
          request.amount, 
          request.currency, 
          'mpesa', 
          'pending',
          { checkoutRequestID: data.CheckoutRequestID, merchantRequestID: data.MerchantRequestID }
        );

        return {
          success: true,
          transactionId: data.CheckoutRequestID,
          reference,
          status: 'pending',
          message: `STK push execution dispatches sent out to system customer endpoint: ${formattedPhone}.`
        };
      }

      throw new Error(data.ResponseDescription || 'STK Push tracking pipeline interface rejected the request.');
    } catch (error: any) {
      try {
        await this.recordTransaction(request.userId, reference, 'deposit', request.amount, request.currency, 'mpesa', 'failed', { error: error.message });
      } catch (dbLogErr) {
        logger.error('[CRITICAL LOSS OF STATE] Failed writing transaction breakdown log inside error resolution scope.', { dbLogErr, reference });
      }
      
      return { success: false, transactionId: '', reference, status: 'failed', message: error.message };
    }
  }

  private async paystackDeposit(config: PaymentGatewayConfig, request: PaymentRequest): Promise<PaymentResponse> {
    const reference = `PSK-${Date.now()}-${Math.random().toString(36).substring(2, 11).toUpperCase()}`;
    const exactAmountInKobo = Math.round(parseFloat(request.amount) * 100);
    
    const payload = {
      email: request.metadata?.email || 'no-reply@mtaadao.com',
      amount: exactAmountInKobo,
      currency: request.currency,
      reference,
      callback_url: request.callbackUrl || `${process.env.APP_URL}/payment/callback`
    };

    try {
      const response = await this.requestWithTimeout('https://api.paystack.co/transaction/initialize', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${config.secretKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });

      const data = await response.json();

      if (data.status) {
        await this.recordTransaction(request.userId, reference, 'deposit', request.amount, request.currency, 'paystack', 'pending');

        return {
          success: true,
          transactionId: data.data.reference,
          paymentUrl: data.data.authorization_url,
          reference,
          status: 'pending',
          message: 'Paystack runtime billing endpoint successfully provisioned.'
        };
      }

      throw new Error(data.message || 'Payment initialization failed');
    } catch (error: any) {
      try {
        await this.recordTransaction(request.userId, reference, 'deposit', request.amount, request.currency, 'paystack', 'failed', { error: error.message });
      } catch (dbLogErr) {
        logger.error('[CRITICAL LOSS OF STATE] Failed writing Paystack breakdown log.', { dbLogErr, reference });
      }
      return { success: false, transactionId: '', reference, status: 'failed', message: error.message };
    }
  }

  private async flutterwaveDeposit(config: PaymentGatewayConfig, request: PaymentRequest): Promise<PaymentResponse> {
    const reference = `FLW-${Date.now()}-${Math.random().toString(36).substring(2, 11).toUpperCase()}`;
    
    const payload = {
      tx_ref: reference,
      amount: request.amount,
      currency: request.currency,
      redirect_url: request.callbackUrl || `${process.env.APP_URL}/payment/callback`,
      customer: {
        email: request.metadata?.email,
        phonenumber: request.metadata?.phone,
        name: request.metadata?.name
      },
      customizations: {
        title: 'MtaaDAO Deposit Load',
        description: 'System asset generation clearing operation',
        logo: 'https://mtaadao.com/logo.png'
      }
    };

    try {
      const response = await this.requestWithTimeout('https://api.flutterwave.com/v3/payments', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${config.secretKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });

      const data = await response.json();

      if (data.status === 'success') {
        await this.recordTransaction(request.userId, reference, 'deposit', request.amount, request.currency, 'flutterwave', 'pending');

        return {
          success: true,
          transactionId: data.data.id.toString(),
          paymentUrl: data.data.link,
          reference,
          status: 'pending',
          message: 'Flutterwave link framework dispatched.'
        };
      }

      throw new Error(data.message || 'Payment initialization failed');
    } catch (error: any) {
      try {
        await this.recordTransaction(request.userId, reference, 'deposit', request.amount, request.currency, 'flutterwave', 'failed', { error: error.message });
      } catch (dbLogErr) {
        logger.error('[CRITICAL LOSS OF STATE] Failed writing Flutterwave breakdown log.', { dbLogErr, reference });
      }
      return { success: false, transactionId: '', reference, status: 'failed', message: error.message };
    }
  }

  private async recordTransaction(
    userId: string,
    reference: string,
    type: string,
    amount: string,
    currency: string,
    provider: string,
    status: string,
    additionalMetadata: Record<string, any> = {}
  ): Promise<void> {
    try {
      await RetryService.executeWithRetry(
        () => db.insert(paymentTransactions).values({
          userId,
          reference,
          type,
          amount,
          currency,
          provider,
          status,
          metadata: { timestamp: new Date().toISOString(), ...additionalMetadata }
        }),
        DEFAULT_RETRY_POLICIES.database,
        { operation: 'recordTransaction', reference }
      );
      
      logger.info('Database transaction state committed', { reference, status, amount });
    } catch (error: any) {
      if (error.code === '23505' || error.constraint?.includes('unique') || error.message?.includes('unique')) {
        logger.warn('Idempotent skip: Transaction log entry already compiled inside active schemas.', { reference });
        return;
      }

      const dbError = PaymentErrorHandler.handleDatabaseError(error, 'recordTransaction', { reference, userId });
      logger.error('Fatal data persistence error during structural logging execution.', { code: dbError.code, reference });
      throw dbError;
    }
  }

  private async getTransactionLimits(userId: string): Promise<{ dailyLimit: number; tier: string }> {
    try {
      const user = await db.select().from(users).where(eq(users.id, userId)).limit(1);
      if (!user.length) {
        throw PaymentErrorHandler.createError(PaymentErrorCode.INVALID_USER, 'Target user registry index missing.', { userId });
      }

      const verificationLevel = (user[0] as any).verificationLevel || 'none';
      const limits = {
        none: { dailyLimit: 100, tier: 'Basic' },
        basic: { dailyLimit: 1000, tier: 'Verified' },
        intermediate: { dailyLimit: 10000, tier: 'Enhanced' },
        advanced: { dailyLimit: 50000, tier: 'Premium' }
      };

      return limits[verificationLevel as keyof typeof limits] || limits.none;
    } catch (error: any) {
      if (error instanceof PaymentError) throw error;
      throw PaymentErrorHandler.handleDatabaseError(error, 'getTransactionLimits', { userId });
    }
  }
}

export const paymentGatewayService = new PaymentGatewayService();