/**
 * PAYMENT GATEWAY SERVICE
 * Resilient multi-provider payment orchestration core engine 
 *
 * CHANGES:
 * - Replaced local idempotencyManager with SharedIdempotencyManager for 
 *   cross-service duplicate-request prevention.
 * - Validation now happens BEFORE idempotency lock acquisition.
 * - Error classification uses structured PaymentErrorCode first, 
 *   heuristic text-parsing second.
 * - Recovery workflow trigger receives structured error metadata.
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
import { sharedIdempotencyManager } from './sharedIdempotencyManager';
import { paymentRecoveryWorkflowService } from './paymentRecoveryWorkflowService';
import { commandBus } from '../domain/setup';
import { PaymentCommandTypes } from '../domain/payments/PaymentCommands';
import crypto from 'crypto';

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

  /**
   * Maps a provider failure to a coarse error category the recovery workflow 
   * can pattern-match. Uses structured codes first, heuristics second.
   */
  private classifyProviderFailure(error: PaymentError | Error | any): string {
    if (error instanceof PaymentError) {
      switch (error.code) {
        case PaymentErrorCode.TIMEOUT: return 'TIMEOUT';
        case PaymentErrorCode.RATE_LIMIT_EXCEEDED: return 'RATE_LIMIT_EXCEEDED';
        case PaymentErrorCode.INSUFFICIENT_FUNDS: return 'INSUFFICIENT_FUNDS';
        case PaymentErrorCode.SERVICE_UNAVAILABLE: return 'SERVICE_UNAVAILABLE';
        case PaymentErrorCode.PROVIDER_API_ERROR: return 'PROVIDER_API_ERROR';
        default: return 'PROVIDER_UNKNOWN_ERROR';
      }
    }

    const m = (error?.message || '').toLowerCase();
    if (m.includes('timeout') || m.includes('timed out')) return 'TIMEOUT';
    if (m.includes('rate limit')) return 'RATE_LIMIT_EXCEEDED';
    if (m.includes('insufficient')) return 'INSUFFICIENT_FUNDS';
    if (m.includes('circuit') || m.includes('unavailable')) return 'SERVICE_UNAVAILABLE';
    if (m.includes('provider') || m.includes('gateway')) return 'PROVIDER_ERROR';
    return 'PROVIDER_UNKNOWN_ERROR';
  }

  private async triggerRecoveryWorkflow(
    operation: 'deposit' | 'withdrawal',
    provider: string,
    request: PaymentRequest,
    reference: string,
    amount: number,
    error: PaymentError | Error | any
  ): Promise<void> {
    try {
      await paymentRecoveryWorkflowService.createRecoveryWorkflow(reference, request.userId, {
        errorCode: this.classifyProviderFailure(error),
        amount,
        currency: request.currency,
        provider,
        operation,
        method: request.method,
        metadata: request.metadata
      });
    } catch (recoveryErr) {
      logger.error('[GATEWAY] Failed to hand off failed payment to recovery workflow', {
        recoveryErr,
        reference,
        provider,
        operation
      });
    }
  }

  async initiateDeposit(
    provider: string, 
    request: PaymentRequest & { idempotencyKey?: string }
  ): Promise<PaymentResponse | ReturnType<typeof PaymentErrorHandler.toResponse>> {
    
    // 1. VALIDATE FIRST (no lock needed for invalid input)
    const validProvider = PaymentValidator.validateProvider(provider);
    const validAmount = PaymentValidator.validateAmount(request.amount);
    const validUserId = PaymentValidator.validateUserId(request.userId);
    const validCurrency = PaymentValidator.validateCurrency(request.currency);

    const phoneFingerprint = request.metadata?.phone 
      ? `:${request.metadata.phone.replace(/\D/g, '').slice(-9)}` 
      : '';
    const idempotencyKey = request.idempotencyKey 
      || `deposit:${validUserId}:${validAmount}:${validCurrency}${phoneFingerprint}`;

    const validatedRequest: PaymentRequest = {
      ...request,
      userId: validUserId,
      amount: validAmount.toString(),
      currency: validCurrency
    };

    // 2. CHECK IDEMPOTENCY
    const cached = await sharedIdempotencyManager.getResult(idempotencyKey);
    if (cached === 'pending') {
      return {
        success: false,
        transactionId: '',
        reference: idempotencyKey,
        status: 'processing',
        message: 'This deposit is already being processed.'
      };
    }
    if (cached && cached !== 'pending') {
      logger.info(`[IDEMPOTENCY CACHE HIT] Deposit for user ${validUserId}`, { idempotencyKey });
      return cached as PaymentResponse;
    }

    // 3. ACQUIRE LOCK
    const acquired = await sharedIdempotencyManager.startProcessing(idempotencyKey);
    if (!acquired) {
      return {
        success: false,
        transactionId: '',
        reference: idempotencyKey,
        status: 'processing',
        message: 'This deposit is already being processed.'
      };
    }

    try {
      const config = this.configs.get(validProvider);
      if (!config) {
        throw PaymentErrorHandler.createError(
          PaymentErrorCode.PROVIDER_NOT_CONFIGURED,
          `Payment provider ${validProvider} configuration missing.`,
          { operation: 'initiateDeposit', service: 'gateway', provider: validProvider }
        );
      }

      const limits = await this.getTransactionLimits(validUserId);
      if (validAmount > limits.dailyLimit) {
        throw PaymentErrorHandler.createError(
          PaymentErrorCode.DAILY_LIMIT_EXCEEDED,
          `Transaction exceeds daily limit of ${limits.dailyLimit} ${validCurrency}`,
          { operation: 'initiateDeposit', service: 'gateway', amount: validAmount, limit: limits.dailyLimit, currency: validCurrency, tier: limits.tier }
        );
      }

      const result = await RetryService.executeWithRetryAndTimeout(
        () => this.executeDeposit(validProvider, config, validatedRequest),
        DEFAULT_RETRY_POLICIES.provider,
        30000,
        { provider: validProvider, userId: validUserId }
      );

      // Provider methods resolve with { success: false } on business errors.
      // We must hand these off to recovery just like thrown errors.
      if (!result.success) {
        await this.triggerRecoveryWorkflow('deposit', validProvider, validatedRequest, result.reference, validAmount, 
          new Error(result.message || 'Provider returned failure'));
      }

      await sharedIdempotencyManager.recordResult(idempotencyKey, result, 3600);
      return result;

    } catch (error: any) {
      const category = error instanceof PaymentError ? 'validation' : 'provider';
      const normalizedError = error instanceof PaymentError
        ? error
        : PaymentErrorHandler.handleProviderError(validProvider, error, { operation: 'initiateDeposit', service: 'gateway' });

      logger.error('Deposit initiation aborted', {
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
          context: normalizedError.context,
        });
      } catch (monitorErr) {
        logger.error('Telemetry logging failed alongside active gateway error.', { monitorErr });
      }

      // Only retryable provider failures go to recovery; validation failures do not.
      if (category === 'provider') {
        const syntheticReference = `FAILED-${validProvider}-${Date.now()}`;
        await this.triggerRecoveryWorkflow('deposit', validProvider, validatedRequest, syntheticReference, validAmount, normalizedError);
      }

      const response = PaymentErrorHandler.toResponse(normalizedError);
      await sharedIdempotencyManager.recordResult(idempotencyKey, response, 3600);
      return response;
    }
  }

  async initiateWithdrawal(
    provider: string, 
    request: PaymentRequest & { idempotencyKey?: string }
  ): Promise<PaymentResponse | ReturnType<typeof PaymentErrorHandler.toResponse>> {
    
    const validProvider = PaymentValidator.validateProvider(provider);
    const validAmount = PaymentValidator.validateAmount(request.amount);
    const validUserId = PaymentValidator.validateUserId(request.userId);
    const validCurrency = PaymentValidator.validateCurrency(request.currency);

    const phoneFingerprint = request.metadata?.phone 
      ? `:${request.metadata.phone.replace(/\D/g, '').slice(-9)}` 
      : '';
    const idempotencyKey = request.idempotencyKey 
      || `withdrawal:${validUserId}:${validAmount}:${validCurrency}${phoneFingerprint}`;

    const validatedRequest: PaymentRequest = {
      ...request,
      userId: validUserId,
      amount: validAmount.toString(),
      currency: validCurrency
    };

    const cached = await sharedIdempotencyManager.getResult(idempotencyKey);
    if (cached === 'pending') {
      return {
        success: false,
        transactionId: '',
        reference: idempotencyKey,
        status: 'processing',
        message: 'This withdrawal is already being processed.'
      };
    }
    if (cached && cached !== 'pending') {
      logger.info(`[IDEMPOTENCY CACHE HIT] Withdrawal for user ${validUserId}`, { idempotencyKey });
      return cached as PaymentResponse;
    }

    const acquired = await sharedIdempotencyManager.startProcessing(idempotencyKey);
    if (!acquired) {
      return {
        success: false,
        transactionId: '',
        reference: idempotencyKey,
        status: 'processing',
        message: 'This withdrawal is already being processed.'
      };
    }

    try {
      const config = this.configs.get(validProvider);
      if (!config) {
        throw PaymentErrorHandler.createError(
          PaymentErrorCode.PROVIDER_NOT_CONFIGURED,
          `Payment provider ${validProvider} configuration missing.`,
          { operation: 'initiateWithdrawal', service: 'gateway', provider: validProvider }
        );
      }

      const result = await RetryService.executeWithRetryAndTimeout(
        () => this.executeWithdrawal(validProvider, config, validatedRequest),
        DEFAULT_RETRY_POLICIES.provider,
        30000,
        { provider: validProvider, userId: validUserId }
      );

      if (!result.success) {
        await this.triggerRecoveryWorkflow('withdrawal', validProvider, validatedRequest, result.reference, validAmount,
          new Error(result.message || 'Provider returned failure'));
      }

      await sharedIdempotencyManager.recordResult(idempotencyKey, result, 3600);
      return result;

    } catch (error: any) {
      const category = error instanceof PaymentError ? 'validation' : 'provider';
      const normalizedError = error instanceof PaymentError
        ? error
        : PaymentErrorHandler.handleProviderError(validProvider, error, { operation: 'initiateWithdrawal', service: 'gateway' });

      logger.error('Withdrawal initiation aborted', {
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
          operation: 'withdrawal',
          userId: validUserId,
          count: 1,
          retryCount: 0,
          statusCode: normalizedError.statusCode,
          message: normalizedError.message,
          context: normalizedError.context,
        });
      } catch (monitorErr) {
        logger.error('Telemetry logging failed alongside active gateway error.', { monitorErr });
      }

      if (category === 'provider') {
        const syntheticReference = `FAILED-${validProvider}-${Date.now()}`;
        await this.triggerRecoveryWorkflow('withdrawal', validProvider, validatedRequest, syntheticReference, validAmount, normalizedError);
      }

      const response = PaymentErrorHandler.toResponse(normalizedError);
      await sharedIdempotencyManager.recordResult(idempotencyKey, response, 3600);
      return response;
    }
  }

  async verifyTransaction(
    provider: string, 
    reference: string
  ): Promise<PaymentResponse | ReturnType<typeof PaymentErrorHandler.toResponse>> {
    const validProvider = PaymentValidator.validateProvider(provider);

    if (!reference || reference.trim().length === 0) {
      throw PaymentErrorHandler.createError(
        PaymentErrorCode.TRANSACTION_NOT_FOUND,
        'Reference is required for transaction verification.',
        { operation: 'verifyTransaction', service: 'gateway', provider: validProvider }
      );
    }

    try {
      const [transaction] = await db
        .select()
        .from(paymentTransactions)
        .where(eq(paymentTransactions.reference, reference))
        .limit(1);

      if (!transaction) {
        throw PaymentErrorHandler.createError(
          PaymentErrorCode.TRANSACTION_NOT_FOUND,
          `Transaction with reference ${reference} was not found.`,
          { operation: 'verifyTransaction', service: 'gateway', provider: validProvider, reference }
        );
      }

      if (transaction.provider !== validProvider) {
        throw PaymentErrorHandler.createError(
          PaymentErrorCode.TRANSACTION_NOT_FOUND,
          `No transaction found for provider ${validProvider} and reference ${reference}.`,
          { operation: 'verifyTransaction', service: 'gateway', provider: validProvider, reference }
        );
      }

      return {
        success: transaction.status === 'completed',
        transactionId: transaction.id,
        reference: transaction.reference,
        status: transaction.status as PaymentResponse['status'],
        message: transaction.status === 'completed'
          ? 'Transaction completed successfully.'
          : `Transaction is currently ${transaction.status}.`
      };
    } catch (error: any) {
      const normalizedError = error instanceof PaymentError
        ? error
        : PaymentErrorHandler.handleProviderError(validProvider, error, { operation: 'verifyTransaction', service: 'gateway', reference });

      logger.error('Transaction verification aborted', {
        code: normalizedError.code,
        message: normalizedError.message,
        provider: validProvider,
        reference
      });

      return PaymentErrorHandler.toResponse(normalizedError);
    }
  }

  private async executeWithdrawal(
    provider: string,
    config: PaymentGatewayConfig,
    request: PaymentRequest
  ): Promise<PaymentResponse> {
    const reference = `WD-${Date.now()}-${Math.random().toString(36).substring(2, 11).toUpperCase()}`;

    await this.recordTransaction(
      request.userId,
      reference,
      'withdrawal',
      request.amount,
      request.currency,
      provider,
      'pending',
      {
        method: request.method,
        metadata: request.metadata
      }
    );

    return {
      success: true,
      transactionId: reference,
      reference,
      status: 'pending',
      message: `Withdrawal request queued for ${provider}.`
    };
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
      case 'kotanipay': return this.kotaniPayDeposit(config, request);
      default:
        throw PaymentErrorHandler.createError(
          PaymentErrorCode.INVALID_PROVIDER,
          `Provider operational channel [${provider}] is either unsupported or currently deactivated.`,
          { operation: 'executeDeposit', service: 'gateway', provider }
        );
    }
  }

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
          throw new Error(`Safaricom Token Service returned status: ${response.status}`);
        }

        const data = await response.json();
        if (!data.access_token || !data.expires_in) {
          throw new Error('Malformed token response from gateway authentication pipeline.');
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

  private async kotaniPayDeposit(config: PaymentGatewayConfig, request: PaymentRequest): Promise<PaymentResponse> {
    const reference = `KOT-${Date.now()}-${Math.random().toString(36).substring(2, 11).toUpperCase()}`;

    try {
      const rawPhone = request.metadata?.phone?.replace(/\D/g, '');
      if (!rawPhone) {
        throw new Error('Kotani Pay mobile money payment demands an explicit MSISDN destination.');
      }

      const destinationWallet = request.metadata?.walletAddress || request.metadata?.publicKey;
      if (!destinationWallet) {
        throw new Error('Kotani Pay transactions require an explicit on-chain target wallet address.');
      }

      const payload = {
        apiKey: config.apiKey,
        amount: parseFloat(request.amount),
        currency: request.currency,
        phoneNumber: rawPhone,
        network: request.metadata?.network || 'CELO',
        stablecoin: request.metadata?.stablecoin || 'cUSD',
        walletAddress: destinationWallet,
        txRef: reference,
        callbackUrl: request.callbackUrl || `${process.env.APP_URL}/api/payments/webhooks/kotanipay`
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
        throw new Error('STK push initialization requires a valid MSISDN.');
      }
      const formattedPhone = rawPhone.startsWith('254') ? rawPhone : `254${rawPhone.slice(-9)}`;

      const shortcode = process.env.MPESA_SHORTCODE;
      const passkey = process.env.MPESA_PASSKEY;
      if (!shortcode || !passkey) {
        throw new Error('Critical backend failure: M-Pesa organizational parameters are unconfigured.');
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
        CallBackURL: `${process.env.APP_URL}/api/payments/webhooks/mpesa`,
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
          message: `STK push dispatched to customer endpoint: ${formattedPhone}.`
        };
      }

      throw new Error(data.ResponseDescription || 'STK Push interface rejected the request.');
    } catch (error: any) {
      try {
        await this.recordTransaction(request.userId, reference, 'deposit', request.amount, request.currency, 'mpesa', 'failed', { error: error.message });
      } catch (dbLogErr) {
        logger.error('[CRITICAL LOSS OF STATE] Failed writing M-Pesa breakdown log.', { dbLogErr, reference });
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
        async () => {
          // 1. Dispatch CreatePayment to get it into the system initially
          // (if it already exists, idempotency in the handler handles it)
          const createResult = await commandBus.dispatch({
            id: crypto.randomUUID(),
            type: PaymentCommandTypes.CreatePayment,
            actor: userId,
            correlationId: crypto.randomUUID(),
            timestamp: new Date(),
            payload: {
              reference,
              userId,
              provider: provider as 'paystack' | 'flutterwave' | 'mpesa',
              amount,
              currency: currency as 'KES' | 'NGN' | 'cUSD' | 'MTAA',
              type: type as 'deposit' | 'dao_spawn_fee' | 'redemption',
              metadata: { timestamp: new Date().toISOString(), ...additionalMetadata }
            }
          });

          if (!createResult.success) {
            logger.warn(`[PaymentGatewayService] Failed to create payment via CommandBus: ${createResult.error}`);
            // Could be a duplicate error, which is fine, we continue to check status update below
          }

          // 2. If status is completed or failed (not just pending), dispatch the finalization command
          if (status === 'completed') {
            await commandBus.dispatch({
              id: crypto.randomUUID(),
              type: PaymentCommandTypes.CompletePayment,
              actor: userId,
              correlationId: createResult.correlationId || crypto.randomUUID(),
              timestamp: new Date(),
              payload: { reference, providerMetadata: additionalMetadata }
            });
          } else if (status === 'failed') {
            await commandBus.dispatch({
              id: crypto.randomUUID(),
              type: PaymentCommandTypes.FailPayment,
              actor: userId,
              correlationId: createResult.correlationId || crypto.randomUUID(),
              timestamp: new Date(),
              payload: { reference, reason: additionalMetadata.error || 'Payment initialization failed', providerData: additionalMetadata }
            });
          }
        },
        DEFAULT_RETRY_POLICIES.database,
        { operation: 'recordTransaction', reference }
      );

      logger.info('Database transaction state committed via CommandBus', { reference, status, amount });
    } catch (error: any) {
      if (error.code === '23505' || error.constraint?.includes('unique') || error.message?.includes('unique') || error.message?.includes('DUPLICATE')) {
        logger.warn('Idempotent skip: Transaction log entry already compiled.', { reference });
        return;
      }

      logger.error('CRITICAL PAYMENT STATE LOSS: Failed committing transactional snapshot.', { error: error.message, reference });
      throw error;
    }
  }

  private async getTransactionLimits(userId: string): Promise<{ dailyLimit: number; tier: string }> {
    try {
      const user = await db.select().from(users).where(eq(users.id, userId)).limit(1);
      if (!user.length) {
        throw PaymentErrorHandler.createError(PaymentErrorCode.INVALID_USER, 'Target user registry index missing.', { operation: 'getTransactionLimits', service: 'gateway', userId });
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
      throw PaymentErrorHandler.handleDatabaseError(error, 'getTransactionLimits', { service: 'gateway', userId });
    }
  }
}

export const paymentGatewayService = new PaymentGatewayService();

// ---------------------------------------------------------------------------
// Wiring: register this service as the executor the recovery workflow calls
// back into. One-way import direction avoids circular dependency.
// ---------------------------------------------------------------------------
paymentRecoveryWorkflowService.registerDepositExecutor(async (provider, request) => {
  try {
    const result = await paymentGatewayService.initiateDeposit(provider, request as any);
    // If gateway returned an error-style response, normalize to ExecutorPaymentResponse
    if ((result as any)?.success === false && (result as any).error) {
      const err = (result as any).error;
      return {
        success: false,
        transactionId: '',
        reference: err.context?.reference || '',
        status: 'failed',
        message: err.message || 'Provider error'
      };
    }

    // Otherwise assume it's a valid PaymentResponse
    return result as any;
  } catch (e: any) {
    if (e instanceof PaymentError) {
      return { success: false, transactionId: '', reference: e.context?.reference || '', status: 'failed', message: e.message };
    }
    return { success: false, transactionId: '', reference: '', status: 'failed', message: e?.message || 'Unknown error' };
  }
});

paymentRecoveryWorkflowService.registerWithdrawalExecutor(async (provider, request) => {
  try {
    const result = await paymentGatewayService.initiateWithdrawal(provider, request as any);
    if ((result as any)?.success === false && (result as any).error) {
      const err = (result as any).error;
      return {
        success: false,
        transactionId: '',
        reference: err.context?.reference || '',
        status: 'failed',
        message: err.message || 'Provider error'
      };
    }
    return result as any;
  } catch (e: any) {
    if (e instanceof PaymentError) {
      return { success: false, transactionId: '', reference: e.context?.reference || '', status: 'failed', message: e.message };
    }
    return { success: false, transactionId: '', reference: '', status: 'failed', message: e?.message || 'Unknown error' };
  }
});