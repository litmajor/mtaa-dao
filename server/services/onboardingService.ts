
import { db } from '../db';
import { sql } from 'drizzle-orm';

interface OnboardingStep {
  id: string;
  title: string;
  description: string;
  completed: boolean;
  order: number;
}

interface OnboardingSession {
  userId: string;
  currentStep: number;
  steps: OnboardingStep[];
  startedAt: Date;
  completedAt?: Date;
  progress: number;
}

export class OnboardingService {
  private sessions: Map<string, OnboardingSession> = new Map();

  private readonly defaultSteps: OnboardingStep[] = [
    {
      id: 'welcome',
      title: 'Welcome to MtaaDAO',
      description: 'Learn about the platform basics',
      completed: false,
      order: 1
    },
    {
      id: 'wallet_setup',
      title: 'Setup Your Wallet',
      description: 'Configure your wallet for transactions',
      completed: false,
      order: 2
    },
    {
      id: 'dao_tour',
      title: 'DAO Dashboard Tour',
      description: 'Explore the main features',
      completed: false,
      order: 3
    },
    {
      id: 'treasury_basics',
      title: 'Treasury Management',
      description: 'Understand fund management',
      completed: false,
      order: 4
    },
    {
      id: 'proposal_creation',
      title: 'Create Your First Proposal',
      description: 'Learn how to submit proposals',
      completed: false,
      order: 5
    },
    {
      id: 'voting',
      title: 'Participate in Voting',
      description: 'Vote on active proposals',
      completed: false,
      order: 6
    }
  ];

  /**
   * Start or resume onboarding session
   */
  async getOnboardingSession(userId: string): Promise<OnboardingSession> {
    // Check in-memory cache
    let session = this.sessions.get(userId);
    
    if (session) {
      return session;
    }

    // Try to load from database
    const savedProgress = await this.loadProgressFromDB(userId);
    
    if (savedProgress) {
      session = savedProgress;
    } else {
      // Create new session
      session = {
        userId,
        currentStep: 0,
        steps: [...this.defaultSteps],
        startedAt: new Date(),
        progress: 0
      };
    }

    this.sessions.set(userId, session);
    return session;
  }

  /**
   * Complete a specific onboarding step
   */
  async completeStep(userId: string, stepId: string): Promise<OnboardingSession> {
    const session = await this.getOnboardingSession(userId);
    
    const stepIndex = session.steps.findIndex(s => s.id === stepId);
    if (stepIndex === -1) {
      throw new Error(`Step ${stepId} not found`);
    }

    session.steps[stepIndex].completed = true;
    
    // Update current step to next incomplete step
    const nextIncomplete = session.steps.findIndex(s => !s.completed);
    session.currentStep = nextIncomplete === -1 ? session.steps.length : nextIncomplete;
    
    // Calculate progress
    const completedCount = session.steps.filter(s => s.completed).length;
    session.progress = Math.round((completedCount / session.steps.length) * 100);
    
    // Mark as completed if all steps done
    if (session.progress === 100 && !session.completedAt) {
      session.completedAt = new Date();
      await this.recordCompletion(userId);
    }

    // Save to database
    await this.saveProgressToDB(session);
    
    this.sessions.set(userId, session);
    return session;
  }

  /**
   * Skip onboarding
   */
  async skipOnboarding(userId: string): Promise<void> {
    const session = await this.getOnboardingSession(userId);
    session.completedAt = new Date();
    session.progress = 100;
    
    await this.saveProgressToDB(session);
    await this.recordCompletion(userId);
    this.sessions.delete(userId);
  }

  /**
   * Reset onboarding
   */
  async resetOnboarding(userId: string): Promise<OnboardingSession> {
    const session = {
      userId,
      currentStep: 0,
      steps: [...this.defaultSteps],
      startedAt: new Date(),
      progress: 0
    };
    
    this.sessions.set(userId, session);
    await this.saveProgressToDB(session);
    
    return session;
  }

  /**
   * Get onboarding metrics
   */
  async getMetrics() {
    try {
      const result = await db.execute(sql`
        SELECT 
          COUNT(DISTINCT user_id) as total_users,
          COUNT(DISTINCT CASE WHEN completed_at IS NOT NULL THEN user_id END) as completed_users,
          AVG(CASE WHEN completed_at IS NOT NULL 
            THEN EXTRACT(EPOCH FROM (completed_at - started_at))/3600 
            END) as avg_completion_hours
        FROM user_activities
        WHERE activity_type = 'onboarding_started'
      `);

      return result.rows[0] || {
        total_users: 0,
        completed_users: 0,
        avg_completion_hours: 0
      };
    } catch (error) {
      console.error('Onboarding metrics error:', error);
      return {
        total_users: 0,
        completed_users: 0,
        avg_completion_hours: 0
      };
    }
  }

  /**
   * Save progress to database
   */
  private async saveProgressToDB(session: OnboardingSession): Promise<void> {
    try {
      await db.execute(sql`
        INSERT INTO user_activities (user_id, activity_type, metadata, created_at)
        VALUES (
          ${session.userId},
          'onboarding_progress',
          ${JSON.stringify({
            currentStep: session.currentStep,
            steps: session.steps,
            progress: session.progress,
            completedAt: session.completedAt
          })},
          NOW()
        )
        ON CONFLICT (user_id, activity_type) 
        DO UPDATE SET 
          metadata = EXCLUDED.metadata,
          created_at = NOW()
      `);
    } catch (error) {
      console.error('Save onboarding progress error:', error);
    }
  }

  /**
   * Load progress from database
   */
  private async loadProgressFromDB(userId: string): Promise<OnboardingSession | null> {
    try {
      const result = await db.execute(sql`
        SELECT metadata, created_at
        FROM user_activities
        WHERE user_id = ${userId} AND activity_type = 'onboarding_progress'
        ORDER BY created_at DESC
        LIMIT 1
      `);

      if (result.rows.length === 0) return null;

      const data = result.rows[0].metadata;
      return {
        userId,
        currentStep: data.currentStep || 0,
        steps: data.steps || this.defaultSteps,
        startedAt: new Date(result.rows[0].created_at),
        completedAt: data.completedAt ? new Date(data.completedAt) : undefined,
        progress: data.progress || 0
      };
    } catch (error) {
      console.error('Load onboarding progress error:', error);
      return null;
    }
  }

  /**
   * Record onboarding completion
   */
  private async recordCompletion(userId: string): Promise<void> {
    try {
      await db.execute(sql`
        INSERT INTO user_activities (user_id, activity_type, created_at)
        VALUES (${userId}, 'onboarding_completed', NOW())
      `);
    } catch (error) {
      console.error('Record completion error:', error);
    }
  }
}

export const onboardingService = new OnboardingService();
