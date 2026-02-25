/**
 * Persona Service
 *
 * Manages user personas (Okedi, Yuki, Amara) and their personalized feature guidance
 */

import { db } from '../db';
import { users } from '../../shared/schema';
import { eq } from 'drizzle-orm';
import { Logger } from '../utils/logger';
import { sql } from 'drizzle-orm';

const logger = new Logger('persona-service');

export type PersonaType = 'okedi' | 'yuki' | 'amara' | null;

export interface Persona {
  id: PersonaType;
  name: string;
  role: string;
  description: string;
  icon: string;
  color: string;
  focusAreas: string[];
  unlockPriorities: string[];
}

/**
 * Persona definitions with their characteristics
 */
export const PERSONAS: Record<PersonaType, Persona> = {
  okedi: {
    id: 'okedi',
    name: 'MTAA Community',
    displayName: 'Okedi',
    role: 'Community Leader & Governor',
    description: 'Build governance, lead DAOs, create proposals and coordinate communities',
    icon: '🎤',
    color: '#8B5CF6',
    focusAreas: [
      'dao.create',
      'proposal.create',
      'governance.vote',
      'dao.join'
    ],
    unlockPriorities: [
      'proposal.create',
      'governance.vote',
      'dao.create',
      'ai.assistant'
    ]
  },
  yuki: {
    id: 'yuki',
    name: 'MTAA Trader',
    displayName: 'Yuki',
    role: 'Advanced Trader & Developer',
    description: 'Trade, optimize yield, execute smart contracts and analyze protocols',
    icon: '🛠️',
    color: '#06B6D4',
    focusAreas: [
      'trading.dex',
      'vault.yield',
      'ai.assistant',
      'investment.pools'
    ],
    unlockPriorities: [
      'trading.dex',
      'vault.yield',
      'investment.pools',
      'ai.assistant'
    ]
  },
  amara: {
    id: 'amara',
    name: 'MTAA Investor',
    displayName: 'Amara',
    role: 'Wealth Builder & Investor',
    description: 'Grow wealth, explore yield opportunities and maximize returns',
    icon: '💰',
    color: '#EC4899',
    focusAreas: [
      'vault.yield',
      'investment.pools',
      'governance.vote',
      'ai.assistant'
    ],
    unlockPriorities: [
      'vault.yield',
      'investment.pools',
      'governance.vote',
      'ai.assistant'
    ]
  }
};

/**
 * Get user's current active subprofile
 * Reads from user's activeSubprofile field
 */
export async function getUserActiveSubprofile(userId: string): Promise<PersonaType> {
  try {
    const user = await db.query.users.findFirst({
      where: (u, { eq }) => eq(u.id, userId)
    });

    return (user?.activeSubprofile as PersonaType) || 'okedi'; // Default to okedi if not set
  } catch (error) {
    logger.error(`Failed to get active subprofile for user ${userId}:`, error);
    return 'okedi';
  }
}

/**
 * Get user's current persona (legacy - now use getUserActiveSubprofile)
 * Kept for backwards compatibility
 */
export async function getUserPersona(userId: string): Promise<PersonaType> {
  return getUserActiveSubprofile(userId);
}

/**
 * Set user's active subprofile (switch subprofiles)
 * Subprofiles are personas that users can switch between anytime
 * Similar to browser profiles - all features accessible in any subprofile, just UI reorganizes
 */
export async function setActiveSubprofile(userId: string, subprofile: PersonaType): Promise<boolean> {
  try {
    if (!subprofile || !PERSONAS[subprofile]) {
      logger.warn(`Invalid subprofile: ${subprofile}`);
      return false;
    }

    // Update user's activeSubprofile field
    await db.update(users)
      .set({ activeSubprofile: subprofile, updatedAt: new Date() })
      .where(eq(users.id, userId));

    logger.info(`Active subprofile switched for user ${userId}: ${subprofile}`);
    return true;
  } catch (error) {
    logger.error(`Failed to set active subprofile for user ${userId}:`, error);
    return false;
  }
}

/**
 * Set user's persona (legacy - now use setActiveSubprofile)
 * Kept for backwards compatibility
 */
export async function setUserPersona(userId: string, persona: PersonaType): Promise<boolean> {
  return setActiveSubprofile(userId, persona);
}

/**
 * Get all available personas
 */
export function getAllPersonas(): Persona[] {
  return Object.values(PERSONAS);
}

/**
 * Get specific persona details
 */
export function getPersonaDetails(persona: PersonaType): Persona | null {
  return persona ? PERSONAS[persona] : null;
}

/**
 * Get persona-specific unlock path for a feature
 * Returns which features should unlock in what order for this persona
 */
export function getPersonaUnlockPath(persona: PersonaType): string[] {
  if (!persona || !PERSONAS[persona]) {
    return [];
  }
  return PERSONAS[persona].unlockPriorities;
}

/**
 * Check if a feature is prioritized for persona
 */
export function isFeaturePrioritized(persona: PersonaType, feature: string): boolean {
  if (!persona || !PERSONAS[persona]) return false;
  return PERSONAS[persona].focusAreas.includes(feature);
}
