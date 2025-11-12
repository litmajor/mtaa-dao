/**
 * Intent Classification Module
 *
 * Classifies user messages into specific intents and extracts entities.
 * Uses pattern matching and keyword detection (can be upgraded to ML models later).
 */

import type { Intent, IntentType } from '../types';

export class IntentClassifier {
  private intentPatterns: Map<IntentType, { patterns: RegExp[]; priority: number }>;

  constructor() {
    this.intentPatterns = this.buildIntentPatterns();
  }

  /**
   * Classify user message into an intent
   */
  classify(message: string): Intent {  // Made sync since no async ops
    const normalizedMessage = message.toLowerCase().trim();

    // Collect all matching intents with their confidence (based on match strength)
    const matches: { type: IntentType; confidence: number }[] = [];

    for (const [intentType, { patterns }] of this.intentPatterns.entries()) {
      for (const pattern of patterns) {
        const match = pattern.exec(normalizedMessage);
        if (match) {
          // Confidence based on match length / message length (simple heuristic)
          const confidence = match[0].length / normalizedMessage.length;
          matches.push({ type: intentType, confidence });
          break;  // Only one pattern per intent
        }
      }
    }

    if (matches.length === 0) {
      return {
        type: 'unknown',
        entities: {},
        confidence: 0.1,
        language: this.detectLanguage(message),
        sentiment: this.analyzeSentiment(message)
      };
    }

    // Sort by confidence descending, then by priority if tied
    matches.sort((a, b) => b.confidence - a.confidence || (this.intentPatterns.get(b.type)!.priority - this.intentPatterns.get(a.type)!.priority));

    const bestMatch = matches[0];
    return {
      type: bestMatch.type,
      entities: this.extractEntities(normalizedMessage, bestMatch.type),
      confidence: bestMatch.confidence,
      language: this.detectLanguage(message),
      sentiment: this.analyzeSentiment(message)
    };
  }

  /**
   * Build intent pattern mappings with priorities (higher = more specific)
   */
  private buildIntentPatterns(): Map<IntentType, { patterns: RegExp[]; priority: number }> {
    return new Map([
      ['onboarding', {
        patterns: [
          /onboarding|get started|begin onboarding|start onboarding|onboard me|start here|begin here|walk me through|help me onboard/i,
        ],
        priority: 6.5 // Between join_dao and check_balance
      }],
      ['vote', {
        patterns: [
          /vote|piga kura|support|i agree|ninapiga kura/i,
          /yes.*proposal|no.*proposal|abstain/i,
          /vote\s+(yes|no|abstain)\s+on\s+proposal/i
        ],
        priority: 10  // High priority for specific actions
      }],
      ['submit_proposal', {
        patterns: [
          /submit.*proposal|create.*proposal|new.*proposal/i,
          /proposal|nataka kuomba|suggest|propose/i,
          /i want to.*propose|submit.*idea/i
        ],
        priority: 9
      }],
      ['check_proposal', {
        patterns: [
          /proposal.*status|check.*proposal|view.*proposal/i,
          /what.*proposals|active.*proposals/i
        ],
        priority: 8
      }],
      ['withdraw', {
        patterns: [
          /withdraw|nataka kutoa|pull out|take out/i,
          /send.*to.*wallet|transfer out/i,
          /withdraw\s+\d+/i  // Amount-specific
        ],
        priority: 7
      }],
      ['deposit', {
        patterns: [
          /deposit|weka|top up|add funds|contribute/i,
          /nataka kuweka|i want to deposit/i,
          /deposit\s+\d+/i
        ],
        priority: 7
      }],
      ['check_balance', {
        patterns: [
          /balance|how much|pesa ngapi|kiasi gani/i,
          /vault.*balance|treasury.*balance/i,
          /show.*funds|check.*wallet/i
        ],
        priority: 6
      }],
      ['join_dao', {
        patterns: [
          /join|become.*member|sign up|niunge/i,
          /how.*join|register|onboard/i
        ],
        priority: 5
      }],
      ['help', {
        patterns: [
          /help|nisaidie|what can you|commands/i,
          /how do i|guide|tutorial/i
        ],
        priority: 4
      }],
      ['analytics', {
        patterns: [
          /analytics|statistics|stats|takwimu/i,
          /report|analysis|trends/i
        ],
        priority: 3
      }],
      ['community_stats', {
        patterns: [
          /community|members|wanachama|participation/i,
          /engagement|activity|growth/i
        ],
        priority: 3
      }],
      ['treasury_report', {
        patterns: [
          /treasury|funds|budget|fedha/i,
          /financial.*report|spending|expenses/i
        ],
        priority: 3
      }],
      ['governance_info', {
        patterns: [
          /governance|voting.*power|quorum|utawala/i,
          /how.*voting.*works|proposal.*process/i
        ],
        priority: 3
      }],
      ['onboarding_tour', {
        patterns: [
          /show me around|tour|guide|walk through|help me start|getting started/i,
        ],
        priority: 2
      }],
      ['onboarding_proposals', {
        patterns: [
          /how.*proposal|create proposal|make proposal/i,
        ],
        priority: 2
      }],
      ['onboarding_voting', {
        patterns: [
          /how.*vote|voting guide|how to vote/i,
        ],
        priority: 2
      }],
      ['onboarding_treasury', {
        patterns: [
          /explain treasury|treasury help|how treasury/i,
        ],
        priority: 2
      }]
    ]);
  }

  /**
   * Extract entities from message based on intent
   */
  private extractEntities(message: string, intent: IntentType): Record<string, any> {
    const entities: Record<string, any> = {};

    // Intent-specific extraction to reduce false positives
    if (['deposit', 'withdraw', 'check_balance', 'treasury_report'].includes(intent)) {
      // Extract amounts only for financial intents
      const amountMatch = message.match(/\b(\d+(?:,\d{3})*(?:\.\d{2})?)\s*(kes|usd|celo|ckes)?\b/i);
      if (amountMatch) {
        entities.amount = parseFloat(amountMatch[1].replace(/,/g, ''));
        if (amountMatch[2]) {
          entities.currency = amountMatch[2].toUpperCase();
        }
      }
    }

    if (['withdraw', 'deposit'].includes(intent)) {
      // Extract wallet addresses for transfer intents
      const addressMatch = message.match(/\b0x[a-fA-F0-9]{40}\b/);
      if (addressMatch) {
        entities.address = addressMatch[0];
      }
    }

    if (['vote', 'submit_proposal', 'check_proposal'].includes(intent)) {
      // Extract proposal IDs for governance intents
      const proposalIdMatch = message.match(/proposal\s*#?(\d+|[a-f0-9-]{36})/i);
      if (proposalIdMatch) {
        entities.proposalId = proposalIdMatch[1];
      }
    }

    // Extract timeframes for reporting intents
    if (['analytics', 'community_stats', 'treasury_report', 'governance_info'].includes(intent)) {
      const timeframeMatch = message.match(/(today|yesterday|this week|last week|this month|last month|\d+d)/i);
      if (timeframeMatch) {
        entities.timeframe = timeframeMatch[1].toLowerCase();
      }
    }

    return entities;
  }

  /**
   * Detect language (basic detection, expanded keywords)
   */
  private detectLanguage(message: string): string {
    // Expanded Swahili keywords
    const swahiliKeywords = ['nataka', 'pesa', 'ngapi', 'weka', 'toa', 'kiasi', 'kura', 'wanachama', 'fedha', 'nisaidie', 'poa', 'mbaya', 'kuomba', 'niunge'];
    const hasSwahili = swahiliKeywords.some(keyword => message.toLowerCase().includes(keyword));

    return hasSwahili ? 'sw' : 'en';
  }

  /**
   * Basic sentiment analysis with negation handling
   */
  private analyzeSentiment(message: string): number {
    const positiveWords = ['good', 'great', 'excellent', 'love', 'awesome', 'nzuri', 'poa'];
    const negativeWords = ['bad', 'poor', 'hate', 'terrible', 'awful', 'mbaya'];
    const negationWords = ['not', 'no', 'never', 'si'];

    const words = message.toLowerCase().split(/\s+/);
    let sentiment = 0;

    for (let i = 0; i < words.length; i++) {
      let multiplier = 1;
      if (i > 0 && negationWords.includes(words[i-1])) {
        multiplier = -1;
      }
      if (positiveWords.includes(words[i])) {
        sentiment += 0.2 * multiplier;
      } else if (negativeWords.includes(words[i])) {
        sentiment -= 0.2 * multiplier;
      }
    }

    return Math.max(-1, Math.min(1, sentiment));
  }
}