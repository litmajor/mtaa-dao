interface DarajaTokenResponse {
  access_token?: string;
}

interface DarajaRegistrationResponse {
  ResponseCode?: string;
  ResponseDescription?: string;
}

function requiredSetting(name: string): string {
  const value = process.env[name]?.trim();
  if (!value || value === 'REPLACE_WITH_SECRET') {
    throw new Error(`M-Pesa C2B configuration is missing ${name}`);
  }
  return value;
}

function getDarajaBaseUrl(): string {
  const environment = (
    process.env.MPESA_ENVIRONMENT ||
    process.env.MPESA_ENV ||
    'sandbox'
  ).toLowerCase();
  if (environment === 'sandbox' || environment === 'test') {
    return 'https://sandbox.safaricom.co.ke';
  }
  if (environment === 'live' || environment === 'production') {
    return 'https://api.safaricom.co.ke';
  }
  throw new Error('MPESA_ENVIRONMENT must be sandbox or live');
}

function secureCallbackUrl(settingName: string, callbackToken: string): string {
  const callbackUrl = new URL(requiredSetting(settingName));
  if (
    callbackUrl.protocol !== 'https:' ||
    ['localhost', '127.0.0.1', '::1'].includes(callbackUrl.hostname)
  ) {
    throw new Error(`${settingName} must be a publicly reachable HTTPS URL`);
  }
  callbackUrl.searchParams.set('token', callbackToken);
  return callbackUrl.toString();
}

export async function registerMpesaC2bCallbackUrls(): Promise<string> {
  if (process.env.MPESA_C2B_ENABLED !== 'true') {
    throw new Error('M-Pesa C2B collections are disabled');
  }

  const consumerKey = requiredSetting('MPESA_CONSUMER_KEY');
  const consumerSecret = requiredSetting('MPESA_CONSUMER_SECRET');
  const shortcode =
    process.env.MPESA_C2B_SHORTCODE?.trim() ||
    process.env.MPESA_BUSINESS_SHORTCODE?.trim() ||
    requiredSetting('MPESA_SHORTCODE');
  const callbackToken = requiredSetting('MPESA_C2B_CALLBACK_TOKEN');
  if (callbackToken.length < 32) {
    throw new Error('MPESA_C2B_CALLBACK_TOKEN must contain at least 32 characters');
  }
  const validationUrl = secureCallbackUrl('MPESA_C2B_VALIDATION_URL', callbackToken);
  const confirmationUrl = secureCallbackUrl('MPESA_C2B_CONFIRMATION_URL', callbackToken);
  const baseUrl = getDarajaBaseUrl();

  const tokenResponse = await fetch(
    `${baseUrl}/oauth/v1/generate?grant_type=client_credentials`,
    {
      headers: {
        Authorization: `Basic ${Buffer.from(`${consumerKey}:${consumerSecret}`).toString('base64')}`,
      },
      signal: AbortSignal.timeout(15_000),
    }
  );
  const tokenBody = (await tokenResponse.json()) as DarajaTokenResponse;
  if (!tokenResponse.ok || !tokenBody.access_token) {
    throw new Error(`Daraja OAuth request failed with HTTP ${tokenResponse.status}`);
  }

  const registrationResponse = await fetch(`${baseUrl}/mpesa/c2b/v1/registerurl`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${tokenBody.access_token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      ShortCode: shortcode,
      ResponseType: 'Completed',
      ConfirmationURL: confirmationUrl,
      ValidationURL: validationUrl,
    }),
    signal: AbortSignal.timeout(20_000),
  });
  const registrationBody = (await registrationResponse.json()) as DarajaRegistrationResponse;
  if (!registrationResponse.ok || registrationBody.ResponseCode !== '0') {
    throw new Error(
      registrationBody.ResponseDescription ||
        `Daraja C2B URL registration failed with HTTP ${registrationResponse.status}`
    );
  }

  return registrationBody.ResponseDescription || 'C2B callback URLs registered with Daraja';
}
