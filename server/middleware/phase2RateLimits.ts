/**
 * PHASE 2: RATE LIMITING CONFIGURATION
 * 
 * Enforces withdrawal limits per user (no deposit limits)
 * 
 * Strategy:
 * - Deposits: UNLIMITED (encourage participation)
 * - Withdrawals: Rate limited per user (prevent rapid withdrawal attacks)
 */

export const phase2RateLimits = {
  // Withdrawal rate limits (per user, per day)
  withdrawals: {
    // Max 5 withdrawals per user per day
    requestsPerDay: 5,
    windowMs: 24 * 60 * 60 * 1000, // 24 hours
    
    // Max 3 withdrawals per user per hour (burst protection)
    requestsPerHour: 3,
    windowMsHour: 60 * 60 * 1000, // 1 hour
    
    // Max 1 withdrawal per user per 10 minutes (first-line protection)
    requestsPerTenMinutes: 1,
    windowMsShort: 10 * 60 * 1000, // 10 minutes
  },

  // Optional: Max withdrawal amount per transaction (enforced by treasury limits)
  // This is handled by TreasuryValidationService
  
  // Error messages
  errors: {
    tooManyRequestsDay: 'You have reached your daily withdrawal limit (5 per day)',
    tooManyRequestsHour: 'You have reached your hourly withdrawal limit (3 per hour)',
    tooManyRequestsShort: 'Please wait 10 minutes before withdrawing again',
    paymentRequired: 'Upgrade required for higher withdrawal limits',
  },

  // Exclude these endpoints from rate limiting
  excluded: [
    '/api/vaults/deposit', // Deposits unlimited
    '/api/vaults/:vaultId/deposit', // Deposits unlimited
    '/api/health',
    '/api/status',
  ],
};

/**
 * Implementation in Express middleware:
 * 
 * const withdrawalRateLimiter = rateLimit({
 *   windowMs: phase2RateLimits.withdrawals.windowMs,
 *   max: phase2RateLimits.withdrawals.requestsPerDay,
 *   keyGenerator: (req) => {
 *     // Key by user ID, not IP (since API calls may come from same server)
 *     return (req.user as any)?.id || req.ip;
 *   },
 *   message: phase2RateLimits.errors.tooManyRequestsDay,
 *   skip: (req) => {
 *     // Skip rate limiting for deposits
 *     return req.path.includes('deposit');
 *   }
 * });
 * 
 * // Apply to all withdrawal endpoints:
 * app.post('/api/vaults/:vaultId/withdraw', withdrawalRateLimiter, withdrawHandler);
 */
