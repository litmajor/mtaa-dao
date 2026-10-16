interface DarajaB2cResponse {
  ResponseCode?: string;
  ResponseDescription?: string;
  ConversationID?: string;
  OriginatorConversationID?: string;
}

export interface B2cInitiationResult {
  accepted: boolean;
  ambiguous: boolean;
  conversationId?: string;
  originatorConversationId?: string;
  description: string;
}

/** Safaricom B2C amount limits (KES) */
const MIN_AMOUNT = 10;
const MAX_AMOUNT = 150_000;

function requiredSetting(name: string): string {
  const value = process.env[name]?.trim();
  if (!value || value === 'REPLACE_WITH_SECRET') {
    throw new Error(`M-Pesa B2C configuration is missing ${name}`);
  }
  return value;
}

export function getB2cCallbackToken(): string {
  return requiredSetting('MPESA_B2C_CALLBACK_TOKEN');
}

/**
 * Normalises a Kenyan phone number to the international format required by Daraja (2547XXXXXXXX).
 * Accepts: 07..., 7..., +2547..., 2547...
 */
function normalizeKenyanPhone(phone: string): string {
  const cleaned = phone.replace(/[\s\-\(\)]/g, '');
  let normalized: string;

  if (/^254[17]\d{8}$/.test(cleaned)) {
    normalized = cleaned;
  } else if (/^\+254[17]\d{8}$/.test(cleaned)) {
    normalized = cleaned.slice(1);
  } else if (/^0[17]\d{8}$/.test(cleaned)) {
    normalized = `254${cleaned.slice(1)}`;
  } else if (/^[17]\d{8}$/.test(cleaned)) {
    normalized = `254${cleaned}`;
  } else {
    throw new Error(`Invalid Kenyan phone number: ${phone}`);
  }

  return normalized;
}

function validateAmount(amountKes: number): number {
  if (!Number.isInteger(amountKes) || amountKes < MIN_AMOUNT || amountKes > MAX_AMOUNT) {
    throw new Error(
      `Amount must be an integer between ${MIN_AMOUNT} and ${MAX_AMOUNT} KES (received ${amountKes})`
    );
  }
  return amountKes;
}

export async function initiateDarajaB2cPayout(input: {
  phone: string;
  amountKes: number;
  payoutId: string;
  cycleNumber: number;
}): Promise<B2cInitiationResult> {
  if (process.env.MPESA_B2C_ENABLED !== 'true') {
    throw new Error('M-Pesa B2C payouts are disabled');
  }

  // --- Input validation ----------------------------------------------------
  const phone = normalizeKenyanPhone(input.phone);
  const amount = validateAmount(input.amountKes);

  if (!input.payoutId?.trim()) {
    throw new Error('payoutId is required');
  }
  if (!Number.isInteger(input.cycleNumber) || input.cycleNumber < 1) {
    throw new Error('cycleNumber must be a positive integer');
  }

  // --- Configuration -------------------------------------------------------
  const consumerKey = requiredSetting('MPESA_CONSUMER_KEY');
  const consumerSecret = requiredSetting('MPESA_CONSUMER_SECRET');
  const initiatorName = requiredSetting('MPESA_B2C_INITIATOR_NAME');
  const securityCredential = requiredSetting('MPESA_B2C_SECURITY_CREDENTIAL');
  const shortcode =
    process.env.MPESA_B2C_SHORTCODE?.trim() || requiredSetting('MPESA_BUSINESS_SHORTCODE');
  const resultUrl = requiredSetting('MPESA_B2C_RESULT_URL');
  const timeoutUrl = requiredSetting('MPESA_B2C_TIMEOUT_URL');
  const callbackToken = getB2cCallbackToken();

  // Secure the callback URLs
  const callbackUrls = [resultUrl, timeoutUrl].map((callbackUrl) => {
    const parsed = new URL(callbackUrl);
    if (parsed.protocol !== 'https:') {
      throw new Error('M-Pesa B2C callbacks must use HTTPS');
    }
    if (['localhost', '127.0.0.1', '::1'].includes(parsed.hostname)) {
      throw new Error('M-Pesa B2C callback URLs must be publicly reachable');
    }
    parsed.searchParams.set('token', callbackToken);
    return parsed.toString();
  });
  const [securedResultUrl, securedTimeoutUrl] = callbackUrls;

  // Environment
  const environment = (
    process.env.MPESA_ENVIRONMENT ||
    process.env.MPESA_ENV ||
    'sandbox'
  ).toLowerCase();

  if (environment !== 'sandbox' && environment !== 'live') {
    throw new Error('MPESA_ENVIRONMENT must be either "sandbox" or "live"');
  }

  const baseUrl =
    environment === 'live'
      ? 'https://api.safaricom.co.ke'
      : 'https://sandbox.safaricom.co.ke';

  const authorization = `Basic ${Buffer.from(`${consumerKey}:${consumerSecret}`).toString('base64')}`;

  // --- 1. Obtain OAuth token -----------------------------------------------
  let accessToken: string;
  try {
    const tokenResponse = await fetch(
      `${baseUrl}/oauth/v1/generate?grant_type=client_credentials`,
      {
        headers: { Authorization: authorization },
        signal: AbortSignal.timeout(15_000),
      }
    );

    const tokenBody = (await tokenResponse.json()) as { access_token?: string };

    if (
      !tokenResponse.ok ||
      typeof tokenBody.access_token !== 'string' ||
      !tokenBody.access_token
    ) {
      throw new Error(`Daraja OAuth request failed with HTTP ${tokenResponse.status}`);
    }

    accessToken = tokenBody.access_token;
  } catch (error) {
    throw new Error(
      `Unable to obtain a Daraja access token: ${
        error instanceof Error ? error.message : String(error)
      }`
    );
  }

  // --- 2. Initiate B2C payment ---------------------------------------------
  let response: Response;
  try {
    response = await fetch(`${baseUrl}/mpesa/b2c/v1/paymentrequest`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        InitiatorName: initiatorName,
        SecurityCredential: securityCredential,
        CommandID: 'BusinessPayment',
        Amount: amount,
        PartyA: shortcode,
        PartyB: phone,
        Remarks: `DAO rotation cycle ${input.cycleNumber}`,
        QueueTimeOutURL: securedTimeoutUrl,
        ResultURL: securedResultUrl,
        Occasion: input.payoutId.slice(0, 20), // Safaricom limit
      }),
      signal: AbortSignal.timeout(20_000),
    });
  } catch (error) {
    // Network / timeout – outcome is unknown
    return {
      accepted: false,
      ambiguous: true,
      description: `Daraja request outcome is unknown: ${
        error instanceof Error ? error.message : String(error)
      }`,
    };
  }

  // --- 3. Parse response ---------------------------------------------------
  let body: DarajaB2cResponse;
  try {
    body = (await response.json()) as DarajaB2cResponse;
  } catch {
    return {
      accepted: false,
      ambiguous: true,
      description: `Daraja returned an unreadable response (HTTP ${response.status})`,
    };
  }

  if (!response.ok) {
    return {
      accepted: false,
      ambiguous: false,
      description: `Daraja rejected the B2C request with HTTP ${response.status}`,
    };
  }

  if (body.ResponseCode !== '0') {
    return {
      accepted: false,
      ambiguous: false,
      description: body.ResponseDescription || 'Daraja rejected the B2C request',
    };
  }

  if (!body.ConversationID || !body.OriginatorConversationID) {
    return {
      accepted: false,
      ambiguous: true,
      description: 'Daraja accepted the request without returning callback correlation IDs',
    };
  }

  return {
    accepted: true,
    ambiguous: false,
    conversationId: body.ConversationID,
    originatorConversationId: body.OriginatorConversationID,
    description: body.ResponseDescription || 'B2C request accepted by Daraja',
  };
}