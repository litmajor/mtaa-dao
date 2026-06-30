#!/usr/bin/env node
/**
 * test-mpesa-webhook.js
 *
 * Simulates a Safaricom STK Push callback to the MtaaDAO backend.
 * This lets you verify the auto-confirm flow without needing Safaricom
 * to hit the server in a live environment.
 *
 * Usage:
 *   node scripts/test-mpesa-webhook.js <CheckoutRequestID> [amount] [receipt]
 *
 * Examples:
 *   # Simulate a SUCCESSFUL payment:
 *   node scripts/test-mpesa-webhook.js ws_En3kQVK5Pj1nFxbp5AEDn6mgGMFOPa3c 500 QHF3ABCDEF
 *
 *   # Simulate a FAILED/CANCELLED payment:
 *   node scripts/test-mpesa-webhook.js ws_En3kQVK5Pj1nFxbp5AEDn6mgGMFOPa3c --fail
 *
 * Notes:
 *   - The CheckoutRequestID must already exist in the `paymentTransactions`
 *     table (created when the STK push was initiated) — stored in metadata->>checkoutRequestID
 *   - The PRIMARY endpoint tested is: POST /api/v1/wallets/rails/gateway/mpesa/callback
 *   - Fallback endpoint also tested:  POST /api/payment-gateway/mpesa/callback
 */

const http = require('http');

const BASE_URL = process.env.API_URL || 'http://localhost:5000';

const args = process.argv.slice(2);
const checkoutRequestId = args[0];
const isFail = args.includes('--fail');
const amount = parseFloat(args.find(a => !a.startsWith('--') && a !== checkoutRequestId) || '500');
const receipt = 'MPT' + Date.now().toString().slice(-8);

if (!checkoutRequestId) {
  console.error('❌ Usage: node scripts/test-mpesa-webhook.js <CheckoutRequestID> [amount] [--fail]');
  process.exit(1);
}

// Build the STK push callback payload — mirrors exactly what Safaricom sends
const successPayload = {
  Body: {
    stkCallback: {
      MerchantRequestID: 'test-merchant-' + Date.now(),
      CheckoutRequestID: checkoutRequestId,
      ResultCode: 0,
      ResultDesc: 'The service request is processed successfully.',
      CallbackMetadata: {
        Item: [
          { Name: 'Amount',            Value: amount },
          { Name: 'MpesaReceiptNumber', Value: receipt },
          { Name: 'TransactionDate',   Value: parseInt(new Date().toISOString().replace(/\D/g, '').slice(0, 14)) },
          { Name: 'PhoneNumber',       Value: 254700000000 },
        ]
      }
    }
  }
};

const failPayload = {
  Body: {
    stkCallback: {
      MerchantRequestID: 'test-merchant-' + Date.now(),
      CheckoutRequestID: checkoutRequestId,
      ResultCode: 1032,
      ResultDesc: '[TEST] Request cancelled by user',
    }
  }
};

const payload = JSON.stringify(isFail ? failPayload : successPayload);

async function postWebhook(path) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, BASE_URL);
    const options = {
      hostname: url.hostname,
      port: url.port || 80,
      path: url.pathname,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(payload),
      },
    };

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try { resolve({ status: res.statusCode, body: JSON.parse(data) }); }
        catch { resolve({ status: res.statusCode, body: data }); }
      });
    });

    req.on('error', reject);
    req.write(payload);
    req.end();
  });
}

async function run() {
  const scenario = isFail ? '❌ FAILURE (ResultCode=1032)' : `✅ SUCCESS (amount=${amount} KES, receipt=${receipt})`;
  console.log(`\n🔔  M-Pesa Webhook Test`);
  console.log(`   CheckoutRequestID : ${checkoutRequestId}`);
  console.log(`   Scenario          : ${scenario}`);
  console.log(`   Target API        : ${BASE_URL}\n`);

  // Test primary v1 endpoint
  const primaryPath = '/api/v1/wallets/rails/gateway/mpesa/callback';
  console.log(`📡 POST ${primaryPath}`);
  try {
    const r1 = await postWebhook(primaryPath);
    console.log(`   HTTP ${r1.status}`, JSON.stringify(r1.body));
    if (r1.status === 200 && r1.body?.ResultCode === 0) {
      console.log('   ✅ Primary v1 endpoint accepted the callback\n');
    } else {
      console.log('   ⚠️  Primary endpoint returned non-success — check server logs\n');
    }
  } catch (err) {
    console.error(`   ❌ Error reaching ${primaryPath}:`, err.message);
  }

  // Also test the legacy payment-gateway endpoint as a cross-check
  const legacyPath = '/api/payment-gateway/mpesa/callback';
  console.log(`📡 POST ${legacyPath} (legacy cross-check)`);
  try {
    const r2 = await postWebhook(legacyPath);
    console.log(`   HTTP ${r2.status}`, JSON.stringify(r2.body));
    if (r2.status === 200) {
      console.log('   ✅ Legacy endpoint also accepted\n');
    } else {
      console.log('   ℹ️  Legacy endpoint returned', r2.status, '(may require auth token)\n');
    }
  } catch (err) {
    console.error(`   ❌ Error reaching ${legacyPath}:`, err.message);
  }

  console.log('🏁 Done. Check the Contributions Workspace — the transaction should now show "Completed" (or "Failed").');
}

run().catch(console.error);
