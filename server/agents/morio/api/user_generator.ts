/**
 * User Generator for Morio
 * Generates synthetic user profiles and conversations for testing and AI training
 */

import { Logger } from '../../../utils/logger';
import { v4 as uuidv4 } from 'uuid';

const logger = new Logger('morio-user-generator');

export interface GeneratedUser {
  id: string;
  email: string;
  name: string;
  role: 'member' | 'elder' | 'treasurer' | 'admin';
  daoId: string;
  joinedAt: Date;
  profile: {
    bio: string;
    interests: string[];
    contributions: number;
    verificationLevel: 'basic' | 'verified' | 'kyc';
  };
}

export interface GeneratedConversation {
  id: string;
  userId: string;
  daoId: string;
  messages: Array<{
    role: 'user' | 'assistant';
    content: string;
    timestamp: Date;
    intent?: string;
  }>;
  duration: number; // milliseconds
  sentiment: 'positive' | 'neutral' | 'negative';
  resolved: boolean;
}

export interface UserGeneratorConfig {
  useAI?: boolean;
  llmConfig?: {
    apiKey?: string;
    model?: string;
  };
  defaultDaoId?: string;
}

/**
 * User Generator - Creates synthetic user profiles and conversations
 */
export class UserGenerator {
  private config: UserGeneratorConfig;
  private conversationTemplates = {
    balance_check: [
      "What's my current balance?",
      "How much does the DAO have?",
      "Can you show me the treasury balance?",
      "What's the total funds available?"
    ],
    proposal_creation: [
      "I want to create a proposal",
      "How do I submit a proposal?",
      "What's needed for a new proposal?",
      "I have an idea for the DAO"
    ],
    voting: [
      "How do I vote on proposals?",
      "What proposals are active?",
      "Can I see voting details?",
      "How's my voting power calculated?"
    ],
    contribution: [
      "How can I contribute to the DAO?",
      "What's the contribution process?",
      "Can I make a deposit?",
      "How do rewards work?"
    ],
    withdrawal: [
      "Can I withdraw funds?",
      "How do withdrawals work?",
      "What's the withdrawal process?",
      "Are there withdrawal limits?"
    ]
  };

  private nameGeneratorWords = {
    first: ['Alex', 'Jordan', 'Sam', 'Casey', 'Morgan', 'Riley', 'Taylor', 'Cameron', 'Charlie', 'Drew'],
    last: ['Smith', 'Johnson', 'Williams', 'Brown', 'Jones', 'Garcia', 'Miller', 'Davis', 'Rodriguez', 'Martinez'],
    interests: ['DeFi', 'Governance', 'NFTs', 'Sustainability', 'Education', 'Trading', 'Development', 'Community', 'Strategy', 'Marketing']
  };

  constructor(config: UserGeneratorConfig = {}) {
    this.config = config;
    logger.info('UserGenerator initialized');
  }

  /**
   * Generate a random user profile
   */
  generateUser(daoId?: string): GeneratedUser {
    const firstName = this.randomFrom(this.nameGeneratorWords.first);
    const lastName = this.randomFrom(this.nameGeneratorWords.last);
    const name = `${firstName} ${lastName}`;

    const roles: Array<'member' | 'elder' | 'treasurer' | 'admin'> = ['member', 'elder', 'treasurer', 'admin'];
    const role = this.weightedSelection(roles, [0.7, 0.15, 0.1, 0.05]);

    const joinedAt = new Date(Date.now() - Math.random() * 365 * 24 * 60 * 60 * 1000);

    const user: GeneratedUser = {
      id: uuidv4(),
      email: `${name.toLowerCase().replace(' ', '.')}@example.com`,
      name,
      role,
      daoId: daoId || this.config.defaultDaoId || uuidv4(),
      joinedAt,
      profile: {
        bio: `Passionate about ${this.randomFrom(this.nameGeneratorWords.interests)} and community impact`,
        interests: this.getRandomInterests(),
        contributions: Math.floor(Math.random() * 50),
        verificationLevel: this.weightedSelection<'basic' | 'verified' | 'kyc'>(
          ['basic', 'verified', 'kyc'],
          [0.5, 0.3, 0.2]
        )
      }
    };

    logger.debug(`Generated user: ${user.id}`);
    return user;
  }

  /**
   * Generate a batch of users
   */
  generateUsers(count: number, daoId?: string): GeneratedUser[] {
    return Array.from({ length: count }, () => this.generateUser(daoId));
  }

  /**
   * Generate a realistic conversation between user and Morio
   */
  generateConversation(userId: string, daoId: string): GeneratedConversation {
    const conversationTypes = Object.keys(this.conversationTemplates) as Array<keyof typeof this.conversationTemplates>;
    const conversationType = this.randomFrom(conversationTypes);
    const userMessages = this.conversationTemplates[conversationType];

    const startTime = Date.now();
    const messages: GeneratedConversation['messages'] = [];

    // User asks initial question
    const userMessage = this.randomFrom(userMessages);
    messages.push({
      role: 'user',
      content: userMessage,
      timestamp: new Date(startTime),
      intent: conversationType
    });

    // Assistant responds
    const assistantResponse = this.generateAssistantResponse(userMessage, conversationType);
    messages.push({
      role: 'assistant',
      content: assistantResponse,
      timestamp: new Date(startTime + 1000)
    });

    // Optional follow-up (60% chance)
    if (Math.random() < 0.6) {
      const followUp = this.generateFollowUpQuestion(conversationType);
      messages.push({
        role: 'user',
        content: followUp,
        timestamp: new Date(startTime + 2000),
        intent: conversationType
      });

      const followUpResponse = this.generateAssistantResponse(followUp, conversationType);
      messages.push({
        role: 'assistant',
        content: followUpResponse,
        timestamp: new Date(startTime + 3000)
      });
    }

    const duration = Date.now() - startTime;
    const sentiment = this.determineSentiment(userMessage);
    const resolved = Math.random() > 0.2; // 80% resolved

    const conversation: GeneratedConversation = {
      id: uuidv4(),
      userId,
      daoId,
      messages,
      duration,
      sentiment,
      resolved
    };

    logger.debug(`Generated conversation: ${conversation.id} (${conversationType})`);
    return conversation;
  }

  /**
   * Generate realistic assistant response
   */
  private generateAssistantResponse(userMessage: string, conversationType: string): string {
    const responses: Record<string, string[]> = {
      balance_check: [
        "The DAO currently has 50,000 cUSD in the treasury. Your personal balance is 2,500 cUSD.",
        "Treasury balance: 50,000 cUSD. Would you like to see a breakdown by allocation?",
        "Your account balance is 2,500 cUSD. The DAO treasury holds 50,000 cUSD total."
      ],
      proposal_creation: [
        "To create a proposal, you'll need at least 100 cUSD and a clear title and description. Would you like to start one?",
        "Great idea! Proposals require a 100 cUSD deposit and must get 50% approval votes. Let me help you draft one.",
        "You can create a proposal by submitting a title, description, and requested budget. Elder review takes 3-5 days."
      ],
      voting: [
        "There are currently 5 active proposals. Your voting power is 25 votes based on your contributions. Which proposal interests you?",
        "Your voting power: 25 votes. You can vote on any active proposal. Want to see the details of a specific one?",
        "You have enough voting power to vote on all active proposals. Current active proposals: 5. Which would you like to learn about?"
      ],
      contribution: [
        "You can contribute by sending funds to the DAO wallet. Contributions earn you voting power and potential rewards!",
        "Members can contribute any amount. Each 100 cUSD earns you approximately 10 voting power points.",
        "Contributions help grow the DAO treasury. You'll receive recognition and voting power based on your contribution amount."
      ],
      withdrawal: [
        "Withdrawals are processed within 48 hours. You have 2,500 cUSD available to withdraw. What amount would you like?",
        "You can withdraw up to 80% of your available balance. Processing time is typically 24-48 hours.",
        "For security, withdrawals are subject to DAO approval. Your request will be reviewed by the treasurer within 24 hours."
      ]
    };

    return this.randomFrom(responses[conversationType] || responses.balance_check);
  }

  /**
   * Generate a follow-up question
   */
  private generateFollowUpQuestion(conversationType: string): string {
    const followUps: Record<string, string[]> = {
      balance_check: [
        "Can you show me the transaction history?",
        "How is the treasury allocated?",
        "What's been the biggest expense?"
      ],
      proposal_creation: [
        "What's the typical approval timeline?",
        "How many signatures do I need?",
        "Can I edit my proposal after submission?"
      ],
      voting: [
        "How often are votes held?",
        "Can I see past voting results?",
        "What's the voting duration?"
      ],
      contribution: [
        "Are contributions tax-deductible?",
        "How often are rewards distributed?",
        "What happens if I contribute monthly?"
      ],
      withdrawal: [
        "Is there a minimum withdrawal amount?",
        "Are there withdrawal fees?",
        "How long does processing usually take?"
      ]
    };

    return this.randomFrom(followUps[conversationType] || ["Tell me more about that"]);
  }

  /**
   * Determine sentiment of message
   */
  private determineSentiment(message: string): 'positive' | 'neutral' | 'negative' {
    const positiveWords = ['great', 'excellent', 'thank', 'love', 'awesome', 'perfect'];
    const negativeWords = ['bad', 'hate', 'wrong', 'problem', 'issue', 'broken'];

    const lower = message.toLowerCase();
    const hasPositive = positiveWords.some(word => lower.includes(word));
    const hasNegative = negativeWords.some(word => lower.includes(word));

    if (hasPositive && !hasNegative) return 'positive';
    if (hasNegative && !hasPositive) return 'negative';
    return 'neutral';
  }

  /**
   * Get random interests
   */
  private getRandomInterests(): string[] {
    const interestCount = Math.floor(Math.random() * 3) + 1;
    const interests: string[] = [];
    while (interests.length < interestCount) {
      const interest = this.randomFrom(this.nameGeneratorWords.interests);
      if (!interests.includes(interest)) {
        interests.push(interest);
      }
    }
    return interests;
  }

  /**
   * Utility: Select random element from array
   */
  private randomFrom<T>(array: T[]): T {
    return array[Math.floor(Math.random() * array.length)];
  }

  /**
   * Utility: Weighted random selection
   */
  private weightedSelection<T>(items: T[], weights: number[]): T {
    const total = weights.reduce((a, b) => a + b, 0);
    let random = Math.random() * total;

    for (let i = 0; i < items.length; i++) {
      random -= weights[i];
      if (random <= 0) {
        return items[i];
      }
    }

    return items[items.length - 1];
  }
}

export default UserGenerator;
