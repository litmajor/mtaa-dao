/**
 * CAPITAL FLOW RATE LIMITING - Treasury & Vault Operations
 * 
 * Enforces rate limits on deposits and withdrawals to prevent:
 * - Rapid-fire withdrawal attacks
 * - Mass withdrawal spam
 * - Manipulation via high-frequency operations
 * 
 * Strategy:
 * - Deposits: GENEROUS (encourage participation)
 * - Withdrawals: CONSERVATIVE (prevent abuse)
 */

export const capitalFlowRateLimits = {
  // DEPOSITS: Generous limits (encourage participation)
  deposits: {
    // Max 50 deposits per user per day
    requestsPerDay: 50,
    windowMs: 24 * 60 * 60 * 1000, // 24 hours
    
    // Max 20 deposits per user per hour (burst protection)
    requestsPerHour: 20,
    windowMsHour: 60 * 60 * 1000, // 1 hour
    
    // Max 5 deposits per user per 10 minutes (spam protection)
    requestsPerTenMinutes: 5,
    windowMsShort: 10 * 60 * 1000, // 10 minutes
  },

  // WITHDRAWALS: Conservative limits (prevent abuse)
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

  // Error messages
  errors: {
    deposits: {
      tooManyRequestsDay: 'You have reached your daily deposit limit (50 per day)',
      tooManyRequestsHour: 'You have reached your hourly deposit limit (20 per hour)',
      tooManyRequestsShort: 'Please wait to make another deposit (5 per 10 minutes)',
      paymentRequired: 'Upgrade required for higher deposit limits',
    },
    withdrawals: {
      tooManyRequestsDay: 'You have reached your daily withdrawal limit (5 per day)',
      tooManyRequestsHour: 'You have reached your hourly withdrawal limit (3 per hour)',
      tooManyRequestsShort: 'Please wait 10 minutes before withdrawing again',
      paymentRequired: 'Upgrade required for higher withdrawal limits',
    },
  },

  // Exclude these endpoints from rate limiting
  excluded: [
    '/api/health',
    '/api/status',
  ],
};

/**
 * Implementation in Express middleware:
 * 
 * // DEPOSITS: Generous rate limiting
 * const depositRateLimiter = rateLimit({
 *   windowMs: capitalFlowRateLimits.deposits.windowMs,
 *   max: capitalFlowRateLimits.deposits.requestsPerDay,
 *   keyGenerator: (req) => (req.user as any)?.id || req.ip,
 *   message: capitalFlowRateLimits.errors.deposits.tooManyRequestsDay,
 *   skip: (req) => req.path.includes('withdraw'),
 * });
 * 
 * // WITHDRAWALS: Conservative rate limiting
 * const withdrawalRateLimiter = rateLimit({
 *   windowMs: capitalFlowRateLimits.withdrawals.windowMs,
 *   max: capitalFlowRateLimits.withdrawals.requestsPerDay,
 *   keyGenerator: (req) => (req.user as any)?.id || req.ip,
 *   message: capitalFlowRateLimits.errors.withdrawals.tooManyRequestsDay,
 *   skip: (req) => req.path.includes('deposit'),
 * });
 * 
 * // Apply to routes
 * app.post('/api/vaults/:vaultId/deposit', depositRateLimiter, depositHandler);
 * app.post('/api/vaults/:vaultId/withdraw', withdrawalRateLimiter, withdrawHandler);
 */

/**
 * COMPARISON: Deposit vs Withdrawal Rate Limits
 * 
 * DEPOSITS (Generous):
 * - 50 per day   (1 every ~30 minutes)
 * - 20 per hour  (1 every 3 minutes)
 * - 5 per 10min  (1 every 2 minutes)
 * 
 * WITHDRAWALS (Conservative):
 * - 5 per day    (1 every ~5 hours)
 * - 3 per hour   (1 every 20 minutes)
 * - 1 per 10min  (hard restriction)
 * 
 * Rationale:
 * - Deposits build treasury → encourage high frequency
 * - Withdrawals drain treasury → restrict carefully
 * - Asymmetric limits reflect risk profile
 */
