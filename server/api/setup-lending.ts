/**
 * Server API Integration Setup
 * Mount lending and flash loan routes to Express server
 */

// Add this to your main server file (e.g., server.ts or index.ts)

import lendingProtocolsRouter from './lending_protocols';
import flashLoansRouter from './flash_loans';

/**
 * Register API routes
 * Call this in your Express app setup
 */
export function setupLendingAPIs(app: any) {
  // Lending protocol routes
  app.use('/api/lending', lendingProtocolsRouter);

  // Flash loan routes
  app.use('/api/lending', flashLoansRouter);

  console.log('✅ Lending and Flash Loan APIs initialized');
  console.log('Available endpoints:');
  console.log('  GET  /api/lending/protocols');
  console.log('  GET  /api/lending/aave/markets');
  console.log('  GET  /api/lending/aave/market/:asset');
  console.log('  GET  /api/lending/aave/rates');
  console.log('  GET  /api/lending/flash-loan-assets');
  console.log('  GET  /api/lending/flash-loans');
  console.log('  GET  /api/lending/flash-loans/summary');
  console.log('  POST /api/lending/flash-loans/simulate');
  console.log('  GET  /api/lending/flash-loans/estimate/:strategy');
}

/**
 * Usage in main server file:
 * 
 * import express from 'express';
 * import { setupLendingAPIs } from './api/setup-lending';
 * 
 * const app = express();
 * 
 * // ... other middleware ...
 * 
 * // Initialize lending APIs
 * setupLendingAPIs(app);
 * 
 * // ... rest of server setup ...
 * 
 * app.listen(3000, () => {
 *   console.log('Server running on port 3000');
 * });
 */
