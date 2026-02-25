/**
 * Morio Gating Handler
 *
 * Handles gating-related questions and provides contextual guidance
 * Integrates with feature gating system and persona-based recommendations
 */

import { Logger } from '../../../utils/logger';
import { checkFeatureGating, GATING_RULES } from '../../../services/gatingService';
import { 
  getUserPersona, 
  getUserActiveSubprofile,
  getPersonaDetails, 
  getPersonaUnlockPath,
  isFeaturePrioritized 
} from '../../../services/personaService';
import { db } from '../../../db';
import type { User } from '../../../shared/schema';

const logger = new Logger('morio-gating-handler');

export interface GatingContext {
  feature: string;
  isAvailable: boolean;
  reason?: string;
  daysUntilAvailable?: number;
  amountNeeded?: number;
  currency?: string;
  personaAdvice?: string;
  subprofile?: string; // Active subprofile context
}

/**
 * Check if user is asking about a locked feature
 */
export function detectGatingQuestion(userMessage: string): string | null {
  const features = Object.keys(GATING_RULES);
  const lowerMessage = userMessage.toLowerCase();

  // Look for feature keywords
  for (const feature of features) {
    const keywords = getFeatureKeywords(feature);
    for (const keyword of keywords) {
      if (lowerMessage.includes(keyword.toLowerCase())) {
        return feature;
      }
    }
  }

  // Look for generic gating questions
  if (
    lowerMessage.includes('unlock') ||
    lowerMessage.includes('locked') ||
    lowerMessage.includes('access') ||
    lowerMessage.includes('available') ||
    lowerMessage.includes('enabled') ||
    lowerMessage.includes('why can\'t')
  ) {
    return 'generic';
  }

  return null;
}

/**
 * Get gating context for a feature
 * Now includes active subprofile context
 */
export async function getGatingContext(
  userId: string,
  featureKey: string
): Promise<GatingContext | null> {
  try {
    const user = await db.query.users.findFirst({
      where: (u, { eq }) => eq(u.id, userId)
    }) as User;

    if (!user) {
      return null;
    }

    const gatingStatus = await checkFeatureGating(featureKey, user);
    const rule = GATING_RULES[featureKey];

    if (!rule) {
      return null;
    }

    // Get active subprofile for context
    const activeSubprofile = await getUserActiveSubprofile(userId);
    const personaAdvice = activeSubprofile ? getSubprofileSpecificAdvice(activeSubprofile, featureKey) : undefined;

    return {
      feature: featureKey,
      isAvailable: gatingStatus.isAvailable,
      reason: gatingStatus.reason,
      daysUntilAvailable: gatingStatus.daysUntilAvailable,
      amountNeeded: gatingStatus.amountNeeded,
      currency: gatingStatus.currency,
      personaAdvice,
      subprofile: activeSubprofile || undefined
    };
  } catch (error) {
    logger.error(`Failed to get gating context for ${featureKey}:`, error);
    return null;
  }
}

/**
 * Generate Morio's explanation for why a feature is locked
 * Now includes subprofile context
 */
export async function generateGatingExplanation(
  userId: string,
  context: GatingContext
): Promise<string> {
  const { feature, isAvailable, reason, daysUntilAvailable, amountNeeded, currency, subprofile } = context;
  const rule = GATING_RULES[feature];

  if (isAvailable) {
    return `Great news! ${rule?.explanation || feature} is already unlocked for you. You're all set! 🎉`;
  }

  let explanation = '';

  // Base explanation
  explanation += `\n💭 **Why it's locked:** ${reason}\n`;

  // Specific guidance by gating type
  if (daysUntilAvailable !== undefined && daysUntilAvailable > 0) {
    explanation += `\n⏰ **Timeline:** Available in ${daysUntilAvailable} day${daysUntilAvailable > 1 ? 's' : ''}\n`;
    explanation += `Once you reach ${daysUntilAvailable} days of account age, you'll unlock this instantly.`;
  }

  if (amountNeeded !== undefined && amountNeeded > 0) {
    const displayAmount = `${amountNeeded.toLocaleString()} ${currency || 'KES'}`;
    explanation += `\n💰 **What you need:** ${displayAmount} more\n`;
    explanation += `\n**Ways to get ${displayAmount}:**\n`;
    explanation += generateUnlockPaths(feature, currency || 'KES');
  }

  if (feature.includes('advanced')) {
    explanation += `\n\n⚡ **Quick unlock:** Enable Advanced Mode in your Settings → Preferences to access this immediately!`;
  }

  // Add subprofile-specific context
  if (context.personaAdvice) {
    explanation += `\n\n🎯 **As a ${getSubprofileName(subprofile)}:** ${context.personaAdvice}`;
  }

  return explanation;
}

/**
 * Get display name for subprofile
 */
function getSubprofileName(subprofile?: string): string {
  const names: Record<string, string> = {
    'okedi': 'Community Manager',
    'yuki': 'Trader',
    'amara': 'Investor'
  };
  return names[subprofile || 'okedi'] || 'user';
}

/**
 * Generate possible unlock paths for a feature
 */
function generateUnlockPaths(feature: string, currency: string): string {
  const paths: Record<string, string> = {
    'vault.yield': `
1. **Deposit KES** - Add funds from your wallet directly
2. **Refer Friends** - Get 25K per successful referral
3. **Complete Tasks** - Earn through daily activities and bounties
4. **Staking Rewards** - Lock your current balance to earn more`,

    'investment.pools': `
1. **Deposit 50K more** - Build your balance progressively
2. **Refer 2 Friends** - Each friend = 25K bonus (faster!)
3. **Combine strategies** - Deposit + refer for fastest growth
4. **Wait for bonuses** - Daily activity bonuses accumulate`,

    'proposal.create': `
You're ${daysUntilAvailable || 0} days into your account.
Just wait a few more days! The timeline counts automatically.`,

    'governance.vote': `
You need reputation level 1+.
Build reputation by:
1. **Voting thoughtfully** - Each quality vote = +reputation
2. **Participating in DAOs** - Active members get rep boosted
3. **Completing tasks** - Some tasks award reputation`
  };

  return paths[feature] || '1. Build your account activity\n2. Increase your balance gradually\n3. Engage in community participation';
}

/**
 * Generate celebration message when feature unlocks
 */
export function generateCelebrationMessage(feature: string): string {
  const celebrations: Record<string, string> = {
    'trading.dex': `🚀 **You unlocked Trading!** 
Your Advanced Mode is activated. You can now trade on the DEX!
Ready to make your first trade? I can walk you through it.`,

    'vault.yield': `💰 **You unlocked Vault Yield!**
Your balance hit 100K! Time to start earning passive income.
Ready to set up your first vault? 20% APY is waiting!`,

    'proposal.create': `🎤 **You unlocked Proposal Creation!**
You're now a 7-day veteran! Time to make your voice heard in DAOs.
Ready to create your first proposal? 📝`,

    'governance.vote': `✅ **You unlocked Governance Voting!**
Your reputation is growing! You can now vote on DAO decisions.
Want to join a DAO and start voting?`,

    'investment.pools': `🎯 **You unlocked Investment Pools!**
100K balance reached! Private pools with 15% APY are now open.
These are for serious investors like you. Ready to dive in?`,

    'ai.assistant': `🤖 **You unlocked Morio Advanced Features!**
Your reputation is at level 1+! I can now give you deeper insights.
Ask me about trading strategies, governance insights, or anything else!`,

    'dao.create': `🏛️ **You unlocked DAO Creation!**
You can now launch your own DAO and lead a community.
Ready to build something amazing? Let's create it!`
  };

  return celebrations[feature] || `🎉 **Congratulations!** You just unlocked a new feature!`;
}

/**
 * Generate persona-specific advice for a gating situation
 * Updated to use subprofile (active mode) naming
 */
function getSubprofileSpecificAdvice(subprofile: string, feature: string): string {
  const advice: Record<string, Record<string, string>> = {
    okedi: {
      'proposal.create': 'As a Community Manager, creating proposals is how you lead your DAO. You\'re almost there!',
      'governance.vote': 'Your vote shapes the DAO. Build reputation by voting thoughtfully and engaging often.',
      'dao.create': 'Time to launch your own DAO! This is where community leaders like you create impact.',
      'ai.assistant': 'I can help you understand governance mechanics, community dynamics, and DAO management.'
    },
    yuki: {
      'trading.dex': 'DEX trading is your core skill. Enable Advanced Mode in Settings to start immediately!',
      'vault.yield': 'Build your capital stack. Fastest path: deposit, refer friends, or complete tasks.',
      'investment.pools': 'The 15% APY in pools beats standard vaults. Push to the minimum and grab these gains.',
      'leverage.trading': 'Leverage trading is for advanced traders like you. Enable Advanced Mode to access it.',
      'smart.contracts': 'Smart contract execution requires Advanced Mode. You can enable it in Settings.',
      'ai.assistant': 'Ask me about yield optimization, trading strategies, market insights, or protocol analysis.'
    },
    amara: {
      'vault.yield': 'Your first passive income stream! 20% APY is solid for wealth building. You\'re almost there.',
      'investment.pools': 'These exclusive pools offer 15% APY with attractive returns. Reach the minimum and invest.',
      'governance.vote': 'Vote as a stakeholder. Help shape the platform you\'re investing in.',
      'maonovault.access': 'Premium vault access for serious investors. Start with any amount and grow.',
      'ai.assistant': 'I can guide you on wealth strategies, yield optimization, passive income, and smart investments.'
    }
  };

  return advice[subprofile]?.[feature] || '';
}

/**
 * Get keywords that trigger gating questions for a feature
 */
function getFeatureKeywords(feature: string): string[] {
  const keywords: Record<string, string[]> = {
    'trading.dex': ['trade', 'dex', 'swap', 'trading', 'exchange'],
    'vault.yield': ['vault', 'yield', 'savings', 'apy', '20%'],
    'proposal.create': ['proposal', 'create proposal', 'vote', 'governance'],
    'governance.vote': ['vote', 'voting', 'governance', 'dao decision'],
    'investment.pools': ['investment', 'pool', 'pools', 'investor'],
    'ai.assistant': ['morio', 'ai', 'assistant', 'help', 'advise'],
    'dao.create': ['create dao', 'launch dao', 'dao', 'community'],
    'dao.join': ['join dao', 'dao', 'community']
  };

  return keywords[feature] || [];
}

/**
 * Main handler for gating-related messages
 */
export async function handleGatingQuestion(
  userId: string,
  message: string
): Promise<{ isGatingQuestion: boolean; response?: string; context?: GatingContext }> {
  try {
    const detectedFeature = detectGatingQuestion(message);
    
    if (!detectedFeature) {
      return { isGatingQuestion: false };
    }

    // For generic questions, suggest next milestone
    if (detectedFeature === 'generic') {
      const persona = await getUserPersona(userId);
      if (!persona) {
        return {
          isGatingQuestion: true,
          response: 'Choose your persona first (Okedi, Yuki, or Amara) so I can give you personalized guidance on unlocking features!'
        };
      }

      const personaDetails = getPersonaDetails(persona);
      const unlockPath = getPersonaUnlockPath(persona);
      
      if (unlockPath.length === 0) {
        return { isGatingQuestion: false };
      }

      const firstLocked = unlockPath[0];
      const context = await getGatingContext(userId, firstLocked);

      if (context && !context.isAvailable) {
        const explanation = await generateGatingExplanation(userId, context);
        return {
          isGatingQuestion: true,
          response: `I see you're curious about unlocking features! 🎯\n${explanation}`,
          context
        };
      }
    }

    // Handle specific feature questions
    const context = await getGatingContext(userId, detectedFeature);
    if (!context) {
      return { isGatingQuestion: false };
    }

    const explanation = await generateGatingExplanation(userId, context);
    return {
      isGatingQuestion: true,
      response: explanation,
      context
    };
  } catch (error) {
    logger.error('Error handling gating question:', error);
    return { isGatingQuestion: false };
  }
}
