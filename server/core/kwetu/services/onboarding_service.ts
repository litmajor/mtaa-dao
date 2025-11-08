
import { db } from '../../../db';
import { onboardingProgress, onboardingSteps, users, daoMemberships, contributions, votes } from '../../../../shared/schema';
import { eq, and, desc } from 'drizzle-orm';

export class OnboardingService {
  /**
   * Initialize onboarding for a new user
   */
  async initializeOnboarding(userId: string) {
    try {
      // Check if onboarding already exists
      const existing = await db.query.onboardingProgress.findFirst({
        where: eq(onboardingProgress.userId, userId)
      });

      if (existing) {
        return existing;
      }

      // Create new onboarding record
      const [newOnboarding] = await db.insert(onboardingProgress).values({
        userId,
        currentStep: 'welcome',
        completedSteps: [],
        skippedSteps: [],
        progress: 0,
        isCompleted: false,
        metadata: {}
      }).returning();

      return newOnboarding;
    } catch (error) {
      console.error('Initialize onboarding error:', error);
      throw error;
    }
  }

  /**
   * Get user's onboarding progress
   */
  async getProgress(userId: string) {
    try {
      const progress = await db.query.onboardingProgress.findFirst({
        where: eq(onboardingProgress.userId, userId)
      });

      if (!progress) {
        return await this.initializeOnboarding(userId);
      }

      return progress;
    } catch (error) {
      console.error('Get onboarding progress error:', error);
      throw error;
    }
  }

  /**
   * Get all onboarding steps
   */
  async getSteps() {
    try {
      const steps = await db.query.onboardingSteps.findMany({
        orderBy: [desc(onboardingSteps.order)]
      });
      return steps;
    } catch (error) {
      console.error('Get onboarding steps error:', error);
      return [];
    }
  }

  /**
   * Mark a step as completed
   */
  async completeStep(userId: string, stepId: string) {
    try {
      const progress = await this.getProgress(userId);
      const steps = await this.getSteps();
      
      const completedSteps = Array.isArray(progress.completedSteps) 
        ? [...progress.completedSteps, stepId] 
        : [stepId];

      // Calculate progress percentage
      const totalSteps = steps.length;
      const completedCount = completedSteps.length;
      const progressPercent = Math.round((completedCount / totalSteps) * 100);

      // Determine next step
      const currentStepOrder = steps.find(s => s.stepId === stepId)?.order || 0;
      const nextStep = steps.find(s => s.order === currentStepOrder + 1);

      const [updated] = await db.update(onboardingProgress)
        .set({
          completedSteps,
          currentStep: nextStep?.stepId || stepId,
          progress: progressPercent,
          isCompleted: progressPercent === 100,
          completedAt: progressPercent === 100 ? new Date() : null,
          lastActivityAt: new Date()
        })
        .where(eq(onboardingProgress.userId, userId))
        .returning();

      return updated;
    } catch (error) {
      console.error('Complete step error:', error);
      throw error;
    }
  }

  /**
   * Skip a step
   */
  async skipStep(userId: string, stepId: string) {
    try {
      const progress = await this.getProgress(userId);
      const steps = await this.getSteps();

      const skippedSteps = Array.isArray(progress.skippedSteps) 
        ? [...progress.skippedSteps, stepId] 
        : [stepId];

      // Determine next step
      const currentStepOrder = steps.find(s => s.stepId === stepId)?.order || 0;
      const nextStep = steps.find(s => s.order === currentStepOrder + 1);

      const [updated] = await db.update(onboardingProgress)
        .set({
          skippedSteps,
          currentStep: nextStep?.stepId || stepId,
          lastActivityAt: new Date()
        })
        .where(eq(onboardingProgress.userId, userId))
        .returning();

      return updated;
    } catch (error) {
      console.error('Skip step error:', error);
      throw error;
    }
  }

  /**
   * Auto-detect completed steps based on user actions
   */
  async detectCompletedSteps(userId: string) {
    try {
      const user = await db.query.users.findFirst({
        where: eq(users.id, userId)
      });

      if (!user) return;

      const autoCompleteChecks = [
        {
          stepId: 'wallet_setup',
          condition: user.walletAddress !== null && user.walletAddress !== ''
        },
        {
          stepId: 'profile_complete',
          condition: user.firstName && user.lastName && user.bio
        },
        {
          stepId: 'dao_join',
          condition: await this.hasJoinedDao(userId)
        },
        {
          stepId: 'first_contribution',
          condition: await this.hasMadeContribution(userId)
        },
        {
          stepId: 'first_vote',
          condition: await this.hasCastVote(userId)
        }
      ];

      for (const check of autoCompleteChecks) {
        if (check.condition) {
          await this.completeStep(userId, check.stepId);
        }
      }
    } catch (error) {
      console.error('Auto-detect steps error:', error);
    }
  }

  /**
   * Helper: Check if user joined a DAO
   */
  private async hasJoinedDao(userId: string): Promise<boolean> {
    const membership = await db.query.daoMemberships.findFirst({
      where: eq(daoMemberships.userId, userId)
    });
    return !!membership;
  }

  /**
   * Helper: Check if user made a contribution
   */
  private async hasMadeContribution(userId: string): Promise<boolean> {
    const contribution = await db.query.contributions.findFirst({
      where: eq(contributions.userId, userId)
    });
    return !!contribution;
  }

  /**
   * Helper: Check if user cast a vote
   */
  private async hasCastVote(userId: string): Promise<boolean> {
    const vote = await db.query.votes.findFirst({
      where: eq(votes.userId, userId)
    });
    return !!vote;
  }
}
