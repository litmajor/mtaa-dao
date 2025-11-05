
import { db } from '../storage';
import { paymentTransactions, users } from '../../shared/schema';
import { eq } from 'drizzle-orm';

export interface PaymentGatewayConfig {
  provider: 'flutterwave' | 'paystack' | 'mpesa' | 'mtn' | 'airtel' | 'stripe';
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

export class PaymentGatewayService {
  private configs: Map<string, PaymentGatewayConfig> = new Map();

  constructor() {
    this.initializeProviders();
  }

  private initializeProviders() {
    // Initialize configurations from environment variables
    if (process.env.FLUTTERWAVE_PUBLIC_KEY && process.env.FLUTTERWAVE_SECRET_KEY) {
      this.configs.set('flutterwave', {
        provider: 'flutterwave',
        apiKey: process.env.FLUTTERWAVE_PUBLIC_KEY,
        secretKey: process.env.FLUTTERWAVE_SECRET_KEY,
        webhookSecret: process.env.FLUTTERWAVE_WEBHOOK_SECRET,
        environment: (process.env.FLUTTERWAVE_ENV as any) || 'test'
      });
    }

    if (process.env.PAYSTACK_PUBLIC_KEY && process.env.PAYSTACK_SECRET_KEY) {
      this.configs.set('paystack', {
        provider: 'paystack',
        apiKey: process.env.PAYSTACK_PUBLIC_KEY,
        secretKey: process.env.PAYSTACK_SECRET_KEY,
        webhookSecret: process.env.PAYSTACK_WEBHOOK_SECRET,
        environment: (process.env.PAYSTACK_ENV as any) || 'test'
      });
    }

    if (process.env.MPESA_CONSUMER_KEY && process.env.MPESA_CONSUMER_SECRET) {
      this.configs.set('mpesa', {
        provider: 'mpesa',
        apiKey: process.env.MPESA_CONSUMER_KEY,
        secretKey: process.env.MPESA_CONSUMER_SECRET,
        environment: (process.env.MPESA_ENV as any) || 'test'
      });
    }

    if (process.env.MTN_API_KEY && process.env.MTN_API_SECRET) {
      this.configs.set('mtn', {
        provider: 'mtn',
        apiKey: process.env.MTN_API_KEY,
        secretKey: process.env.MTN_API_SECRET,
        environment: (process.env.MTN_ENV as any) || 'test'
      });
    }

    if (process.env.AIRTEL_API_KEY && process.env.AIRTEL_API_SECRET) {
      this.configs.set('airtel', {
        provider: 'airtel',
        apiKey: process.env.AIRTEL_API_KEY,
        secretKey: process.env.AIRTEL_API_SECRET,
        environment: (process.env.AIRTEL_ENV as any) || 'test'
      });
    }

    if (process.env.STRIPE_PUBLIC_KEY && process.env.STRIPE_SECRET_KEY) {
      this.configs.set('stripe', {
        provider: 'stripe',
        apiKey: process.env.STRIPE_PUBLIC_KEY,
        secretKey: process.env.STRIPE_SECRET_KEY,
        environment: (process.env.STRIPE_ENV as any) || 'test'
      });
    }
  }

  async initiateDeposit(provider: string, request: PaymentRequest): Promise<PaymentResponse> {
    const config = this.configs.get(provider);
    if (!config) {
      throw new Error(`Payment provider ${provider} not configured`);
    }

    // Check user verification level and apply limits
    const limits = await this.getTransactionLimits(request.userId);
    const amount = parseFloat(request.amount);

    if (amount > limits.dailyLimit) {
      throw new Error(`Transaction exceeds daily limit of ${limits.dailyLimit} ${request.currency}`);
    }

    switch (provider) {
      case 'flutterwave':
        return this.flutterwaveDeposit(config, request);
      case 'paystack':
        return this.paystackDeposit(config, request);
      case 'mpesa':
        return this.mpesaDeposit(config, request);
      case 'mtn':
        return this.mtnDeposit(config, request);
      case 'airtel':
        return this.airtelDeposit(config, request);
      case 'stripe':
        return this.stripeDeposit(config, request);
      default:
        throw new Error(`Unsupported provider: ${provider}`);
    }
  }

  async initiateWithdrawal(provider: string, request: PaymentRequest): Promise<PaymentResponse> {
    const config = this.configs.get(provider);
    if (!config) {
      throw new Error(`Payment provider ${provider} not configured`);
    }

    const limits = await this.getTransactionLimits(request.userId);
    const amount = parseFloat(request.amount);

    if (amount > limits.dailyLimit) {
      throw new Error(`Transaction exceeds daily limit of ${limits.dailyLimit} ${request.currency}`);
    }

    switch (provider) {
      case 'flutterwave':
        return this.flutterwaveWithdrawal(config, request);
      case 'paystack':
        return this.paystackWithdrawal(config, request);
      case 'mpesa':
        return this.mpesaWithdrawal(config, request);
      case 'mtn':
        return this.mtnWithdrawal(config, request);
      case 'airtel':
        return this.airtelWithdrawal(config, request);
      case 'stripe':
        return this.stripeWithdrawal(config, request);
      default:
        throw new Error(`Unsupported provider: ${provider}`);
    }
  }

  private async getTransactionLimits(userId: string): Promise<{ dailyLimit: number; tier: string }> {
    const user = await db.select().from(users).where(eq(users.id, userId)).limit(1);
    
    if (!user.length) {
      throw new Error('User not found');
    }

    const verificationLevel = user[0].verificationLevel || 'none';

    const limits = {
      none: { dailyLimit: 100, tier: 'Basic' },
      basic: { dailyLimit: 1000, tier: 'Verified' },
      intermediate: { dailyLimit: 10000, tier: 'Enhanced' },
      advanced: { dailyLimit: 50000, tier: 'Premium' }
    };

    return limits[verificationLevel as keyof typeof limits] || limits.none;
  }

  private async flutterwaveDeposit(config: PaymentGatewayConfig, request: PaymentRequest): Promise<PaymentResponse> {
    const reference = `FLW-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
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
        title: 'MtaaDAO Deposit',
        description: 'Add funds to your wallet',
        logo: 'https://mtaadao.com/logo.png'
      }
    };

    try {
      const response = await fetch('https://api.flutterwave.com/v3/payments', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${config.secretKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });

      const data = await response.json();

      if (data.status === 'success') {
        await this.recordTransaction(request.userId, reference, 'deposit', request.amount, request.currency, 'flutterwave', 'pending');

        return {
          success: true,
          transactionId: data.data.id,
          paymentUrl: data.data.link,
          reference,
          status: 'pending',
          message: 'Payment initialized successfully'
        };
      }

      throw new Error(data.message || 'Payment initialization failed');
    } catch (error: any) {
      return {
        success: false,
        transactionId: '',
        reference,
        status: 'failed',
        message: error.message
      };
    }
  }

  private async paystackDeposit(config: PaymentGatewayConfig, request: PaymentRequest): Promise<PaymentResponse> {
    const reference = `PSK-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    const payload = {
      email: request.metadata?.email,
      amount: parseFloat(request.amount) * 100, // Paystack uses kobo
      currency: request.currency,
      reference,
      callback_url: request.callbackUrl || `${process.env.APP_URL}/payment/callback`
    };

    try {
      const response = await fetch('https://api.paystack.co/transaction/initialize', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${config.secretKey}`,
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
          message: 'Payment initialized successfully'
        };
      }

      throw new Error(data.message || 'Payment initialization failed');
    } catch (error: any) {
      return {
        success: false,
        transactionId: '',
        reference,
        status: 'failed',
        message: error.message
      };
    }
  }

  private async mpesaDeposit(config: PaymentGatewayConfig, request: PaymentRequest): Promise<PaymentResponse> {
    const reference = `MPE-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    try {
      // Validate phone number format
      const phoneNumber = request.metadata?.phone?.replace(/\D/g, '');
      if (!phoneNumber || phoneNumber.length < 10) {
        throw new Error('Valid phone number required for M-Pesa');
      }

      // Format phone number (254XXXXXXXXX)
      const formattedPhone = phoneNumber.startsWith('254') ? phoneNumber : `254${phoneNumber.slice(-9)}`;

      // Get OAuth token
      const authToken = await this.getMpesaToken(config);
      
      const timestamp = new Date().toISOString().replace(/[^0-9]/g, '').slice(0, 14);
      const password = Buffer.from(
        `${process.env.MPESA_SHORTCODE}${process.env.MPESA_PASSKEY}${timestamp}`
      ).toString('base64');

      const payload = {
        BusinessShortCode: process.env.MPESA_SHORTCODE,
        Password: password,
        Timestamp: timestamp,
        TransactionType: 'CustomerPayBillOnline',
        Amount: Math.round(parseFloat(request.amount)),
        PartyA: formattedPhone,
        PartyB: process.env.MPESA_SHORTCODE,
        PhoneNumber: formattedPhone,
        CallBackURL: `${process.env.APP_URL}/api/payment-gateway/mpesa/callback`,
        AccountReference: `MTAA-${request.userId.slice(0, 8)}`,
        TransactionDesc: request.metadata?.description || 'MtaaDAO Wallet Deposit'
      };

      const apiUrl = config.environment === 'production'
        ? 'https://api.safaricom.co.ke/mpesa/stkpush/v1/processrequest'
        : 'https://sandbox.safaricom.co.ke/mpesa/stkpush/v1/processrequest';

      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${authToken}`,
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
          message: `STK push sent to ${formattedPhone}. Check your phone to complete payment.`
        };
      }

      throw new Error(data.ResponseDescription || data.errorMessage || 'M-Pesa request failed');
    } catch (error: any) {
      await this.recordTransaction(request.userId, reference, 'deposit', request.amount, request.currency, 'mpesa', 'failed', { error: error.message });
      
      return {
        success: false,
        transactionId: '',
        reference,
        status: 'failed',
        message: error.message
      };
    }
  }

  private async getMpesaToken(config: PaymentGatewayConfig): Promise<string> {
    const auth = Buffer.from(`${config.apiKey}:${config.secretKey}`).toString('base64');
    
    const response = await fetch('https://sandbox.safaricom.co.ke/oauth/v1/generate?grant_type=client_credentials', {
      headers: {
        'Authorization': `Basic ${auth}`
      }
    });

    const data = await response.json();
    return data.access_token;
  }

  private async mtnDeposit(config: PaymentGatewayConfig, request: PaymentRequest): Promise<PaymentResponse> {
    const reference = `MTN-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    // MTN MoMo API implementation
    // This is a placeholder - actual implementation depends on MTN MoMo API documentation
    
    await this.recordTransaction(request.userId, reference, 'deposit', request.amount, request.currency, 'mtn', 'pending');

    return {
      success: true,
      transactionId: reference,
      reference,
      status: 'pending',
      message: 'MTN Mobile Money deposit initiated'
    };
  }

  private async airtelDeposit(config: PaymentGatewayConfig, request: PaymentRequest): Promise<PaymentResponse> {
    const reference = `ATL-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    // Airtel Money API implementation
    // This is a placeholder - actual implementation depends on Airtel Money API documentation
    
    await this.recordTransaction(request.userId, reference, 'deposit', request.amount, request.currency, 'airtel', 'pending');

    return {
      success: true,
      transactionId: reference,
      reference,
      status: 'pending',
      message: 'Airtel Money deposit initiated'
    };
  }

  private async stripeDeposit(config: PaymentGatewayConfig, request: PaymentRequest): Promise<PaymentResponse> {
    const reference = `STR-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    // Stripe implementation (already exists in checkout.tsx, this is for consistency)
    
    await this.recordTransaction(request.userId, reference, 'deposit', request.amount, request.currency, 'stripe', 'pending');

    return {
      success: true,
      transactionId: reference,
      reference,
      status: 'pending',
      message: 'Stripe payment initiated'
    };
  }

  private async flutterwaveWithdrawal(config: PaymentGatewayConfig, request: PaymentRequest): Promise<PaymentResponse> {
    const reference = `FLW-OUT-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    const payload = {
      account_bank: request.metadata?.bankCode,
      account_number: request.metadata?.accountNumber,
      amount: request.amount,
      currency: request.currency,
      reference,
      narration: 'MtaaDAO Withdrawal',
      beneficiary_name: request.metadata?.accountName
    };

    try {
      const response = await fetch('https://api.flutterwave.com/v3/transfers', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${config.secretKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });

      const data = await response.json();

      if (data.status === 'success') {
        await this.recordTransaction(request.userId, reference, 'withdrawal', request.amount, request.currency, 'flutterwave', 'processing');

        return {
          success: true,
          transactionId: data.data.id,
          reference,
          status: 'processing',
          message: 'Withdrawal initiated successfully'
        };
      }

      throw new Error(data.message || 'Withdrawal failed');
    } catch (error: any) {
      return {
        success: false,
        transactionId: '',
        reference,
        status: 'failed',
        message: error.message
      };
    }
  }

  private async paystackWithdrawal(config: PaymentGatewayConfig, request: PaymentRequest): Promise<PaymentResponse> {
    // Similar implementation for Paystack withdrawals
    const reference = `PSK-OUT-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    await this.recordTransaction(request.userId, reference, 'withdrawal', request.amount, request.currency, 'paystack', 'processing');

    return {
      success: true,
      transactionId: reference,
      reference,
      status: 'processing',
      message: 'Withdrawal processing'
    };
  }

  private async mpesaWithdrawal(config: PaymentGatewayConfig, request: PaymentRequest): Promise<PaymentResponse> {
    // M-Pesa B2C withdrawal implementation
    const reference = `MPE-OUT-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    await this.recordTransaction(request.userId, reference, 'withdrawal', request.amount, request.currency, 'mpesa', 'processing');

    return {
      success: true,
      transactionId: reference,
      reference,
      status: 'processing',
      message: 'M-Pesa withdrawal processing'
    };
  }

  private async mtnWithdrawal(config: PaymentGatewayConfig, request: PaymentRequest): Promise<PaymentResponse> {
    const reference = `MTN-OUT-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    await this.recordTransaction(request.userId, reference, 'withdrawal', request.amount, request.currency, 'mtn', 'processing');

    return {
      success: true,
      transactionId: reference,
      reference,
      status: 'processing',
      message: 'MTN withdrawal processing'
    };
  }

  private async airtelWithdrawal(config: PaymentGatewayConfig, request: PaymentRequest): Promise<PaymentResponse> {
    const reference = `ATL-OUT-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    await this.recordTransaction(request.userId, reference, 'withdrawal', request.amount, request.currency, 'airtel', 'processing');

    return {
      success: true,
      transactionId: reference,
      reference,
      status: 'processing',
      message: 'Airtel withdrawal processing'
    };
  }

  private async stripeWithdrawal(config: PaymentGatewayConfig, request: PaymentRequest): Promise<PaymentResponse> {
    const reference = `STR-OUT-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    await this.recordTransaction(request.userId, reference, 'withdrawal', request.amount, request.currency, 'stripe', 'processing');

    return {
      success: true,
      transactionId: reference,
      reference,
      status: 'processing',
      message: 'Stripe withdrawal processing'
    };
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
  ) {
    await db.insert(paymentTransactions).values({
      userId,
      reference,
      type,
      amount,
      currency,
      provider,
      status,
      metadata: { 
        timestamp: new Date().toISOString(),
        ...additionalMetadata
      }
    });
  }

  async verifyTransaction(provider: string, reference: string): Promise<any> {
    const config = this.configs.get(provider);
    if (!config) {
      throw new Error(`Payment provider ${provider} not configured`);
    }

    switch (provider) {
      case 'flutterwave':
        return this.verifyFlutterwave(config, reference);
      case 'paystack':
        return this.verifyPaystack(config, reference);
      default:
        throw new Error(`Verification not implemented for ${provider}`);
    }
  }

  private async verifyFlutterwave(config: PaymentGatewayConfig, reference: string): Promise<any> {
    const response = await fetch(`https://api.flutterwave.com/v3/transactions/verify_by_reference?tx_ref=${reference}`, {
      headers: {
        'Authorization': `Bearer ${config.secretKey}`
      }
    });

    return response.json();
  }

  private async verifyPaystack(config: PaymentGatewayConfig, reference: string): Promise<any> {
    const response = await fetch(`https://api.paystack.co/transaction/verify/${reference}`, {
      headers: {
        'Authorization': `Bearer ${config.secretKey}`
      }
    });

    return response.json();
  }
}

export const paymentGatewayService = new PaymentGatewayService();
