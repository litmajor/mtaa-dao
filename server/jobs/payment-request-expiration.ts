import { db } from '../db';
import { paymentRequests } from '../../shared/schema';
import { eq, lt, and, ne } from 'drizzle-orm';

/**
 * Payment Request Expiration Job
 * 
 * Runs every hour to:
 * - Mark expired payment requests
 * - Send notifications to requesters
 * - Clean up old expired requests (optional)
 */

let expirationJobRunning = false;
let expirationInterval: NodeJS.Timeout | null = null;

/**
 * Initialize the expiration job
 */
export function initializePaymentRequestExpirationJob() {
  console.log('[Payment Request Expiration] Initializing expiration job...');
  
  // Run immediately on startup
  checkAndExpireRequests().catch(console.error);
  
  // Schedule to run every hour
  expirationInterval = setInterval(() => {
    checkAndExpireRequests().catch(console.error);
  }, 60 * 60 * 1000); // 1 hour
  
  console.log('[Payment Request Expiration] Job initialized - runs every hour');
}

/**
 * Check and expire payment requests
 */
async function checkAndExpireRequests() {
  if (expirationJobRunning) {
    console.log('[Payment Request Expiration] Job already running, skipping...');
    return;
  }

  try {
    expirationJobRunning = true;
    const now = new Date();
    
    console.log(`[Payment Request Expiration] Checking for expired requests at ${now.toISOString()}`);

    // Find all pending requests that have passed their expiration date
    const expiredRequests = await db.query.paymentRequests.findMany({
      where: and(
        ne(paymentRequests.status, 'paid'),
        ne(paymentRequests.status, 'expired'),
        ne(paymentRequests.status, 'cancelled'),
        lt(paymentRequests.expiresAt, now)
      ),
    });

    if (expiredRequests.length === 0) {
      console.log('[Payment Request Expiration] No requests to expire');
      expirationJobRunning = false;
      return;
    }

    console.log(`[Payment Request Expiration] Found ${expiredRequests.length} requests to expire`);

    // Update all expired requests
    let successCount = 0;
    for (const request of expiredRequests) {
      try {
        await db.update(paymentRequests)
          .set({
            status: 'expired',
            updatedAt: new Date(),
          })
          .where(eq(paymentRequests.id, request.id));

        successCount++;
        console.log(`[Payment Request Expiration] ✓ Marked request ${request.id} as expired`);

        // Optional: Send notification to requester about expiration
        // TODO: Implement notification service call here
      } catch (error) {
        const errObj = error instanceof Error ? { message: error.message, stack: error.stack } : { message: String(error) };
        console.error(`[Payment Request Expiration] Failed to expire request ${request.id}:`, errObj);
      }
    }

    console.log(`[Payment Request Expiration] Completed: ${successCount}/${expiredRequests.length} requests expired`);
  } catch (error) {
    const errObj = error instanceof Error ? { message: error.message, stack: error.stack } : { message: String(error) };
    console.error('[Payment Request Expiration] Error checking requests:', errObj);
  } finally {
    expirationJobRunning = false;
  }
}

/**
 * Stop the expiration job
 */
export function stopPaymentRequestExpirationJob() {
  if (expirationInterval) {
    clearInterval(expirationInterval);
    expirationInterval = null;
    console.log('[Payment Request Expiration] Job stopped');
  }
}

/**
 * Manually trigger expiration check (useful for testing)
 */
export async function triggerPaymentRequestExpirationCheck() {
  return checkAndExpireRequests();
}
