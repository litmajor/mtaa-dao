import cron from 'node-cron';
import { logger } from '../utils/logger';

/**
 * Weekly Rewards Distribution Job
 * Runs every Sunday at 00:00 (midnight)
 * Distributes MTAA tokens to top 10 referrers from the previous week
 */

export function setupWeeklyRewardsDistribution() {
  // Schedule: Every Sunday at midnight
  // Cron format: minute hour day-of-month month day-of-week
  // '0 0 * * 0' = minute 0, hour 0, every Sunday
  
  const job = cron.schedule('0 0 * * 0', async () => {
    logger.info('🏆 Starting weekly rewards distribution...');
    
    try {
      // Calculate week ending date (last Saturday)
      const now = new Date();
      const weekEnding = new Date(now);
      weekEnding.setDate(now.getDate() - 1); // Yesterday (Saturday if running Sunday midnight)
      weekEnding.setHours(23, 59, 59, 999);
      
      // Call the distribution API
      const response = await fetch('http://localhost:5000/api/referral-rewards/distribute', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.ADMIN_TOKEN || process.env.JWT_SECRET}`,
        },
        body: JSON.stringify({
          weekEnding: weekEnding.toISOString().split('T')[0], // YYYY-MM-DD
        }),
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Distribution failed');
      }
      
      const result = await response.json();
      
      logger.info(`✅ Weekly rewards distributed successfully!`);
      logger.info(`   - Winners: ${result.distributed}`);
      logger.info(`   - Total Amount: ${result.totalAmount} MTAA`);
      logger.info(`   - Week Ending: ${weekEnding.toISOString().split('T')[0]}`);
      
      // TODO: Send email notifications to winners
      // await sendWinnerNotifications(result.distributions);
      
    } catch (error) {
      logger.error('❌ Weekly rewards distribution failed:', error);
      
      // TODO: Send alert to admin
      // await sendAdminAlert('Weekly rewards distribution failed', error);
    }
  }, {
    scheduled: true,
    timezone: "UTC" // Use UTC or your preferred timezone
  });
  
  logger.info('⏰ Weekly rewards distribution job scheduled (Every Sunday at 00:00 UTC)');
  
  return job;
}

/**
 * Manual distribution function (for testing or manual triggers)
 */
export async function triggerManualDistribution(weekEnding: string) {
  logger.info(`🎯 Manual rewards distribution triggered for week ending: ${weekEnding}`);
  
  try {
    const response = await fetch('http://localhost:5000/api/referral-rewards/distribute', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.ADMIN_TOKEN || process.env.JWT_SECRET}`,
      },
      body: JSON.stringify({ weekEnding }),
    });
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Distribution failed');
    }
    
    const result = await response.json();
    logger.info(`✅ Manual distribution completed: ${result.distributed} winners, ${result.totalAmount} MTAA`);
    
    return result;
  } catch (error) {
    logger.error('❌ Manual distribution failed:', error);
    throw error;
  }
}

/**
 * Get next distribution date
 */
export function getNextDistributionDate(): Date {
  const now = new Date();
  const nextSunday = new Date(now);
  const daysUntilSunday = (7 - now.getDay()) % 7 || 7;
  nextSunday.setDate(now.getDate() + daysUntilSunday);
  nextSunday.setHours(0, 0, 0, 0);
  return nextSunday;
}

/**
 * Get days until next distribution
 */
export function getDaysUntilDistribution(): number {
  const now = new Date();
  const next = getNextDistributionDate();
  const diff = next.getTime() - now.getTime();
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}

