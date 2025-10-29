/**
 * Intent Classification Module
 *
 * Classifies user messages into specific intents and extracts entities.
 * Uses pattern matching and keyword detection (can be upgraded to ML models later).
 */

import type { Intent, IntentType } from '../types';

export class IntentClassifier {
  private intentPatterns: Map<IntentType, RegExp[]>;

  constructor() {
    this.intentPatterns = this.buildIntentPatterns();
  }

  /**
   * Classify user message into an intent
   */
  async classify(message: string): Promise<Intent> {
    const normalizedMessage = message.toLowerCase().trim();

    // Check each intent pattern
    for (const [intentType, patterns] of this.intentPatterns.entries()) {
      for (const pattern of patterns) {
        if (pattern.test(normalizedMessage)) {
          return {
            type: intentType,
            entities: this.extractEntities(normalizedMessage, intentType),
            confidence: 0.85,
            language: this.detectLanguage(message),
            sentiment: this.analyzeSentiment(message)
          };
        }
      }
    }

    // Default to unknown intent
    return {
      type: 'unknown',
      entities: {},
      confidence: 0.1,
      language: 'en',
      sentiment: 0
    };
  }

  /**
   * Build intent pattern mappings
   */
  private buildIntentPatterns(): Map<IntentType, RegExp[]> {
    return new Map([
      ['onboarding_tour', [
        /show me around|tour|guide|walk through|help me start|getting started/i,
      ]],
      ['onboarding_proposals', [
        /how.*proposal|create proposal|make proposal/i,
      ]],
      ['onboarding_voting', [
        /how.*vote|voting guide|how to vote/i,
      ]],
      ['onboarding_treasury', [
        /explain treasury|treasury help|how treasury/i,
      ]],
      ['withdraw', [
        /withdraw|nataka kutoa|pull out|take out/i,
        /send.*to.*wallet|transfer out/i
      ]],
      ['deposit', [
        /deposit|weka|top up|add funds|contribute/i,
        /nataka kuweka|i want to deposit/i
      ]],
      ['check_balance', [
        /balance|how much|pesa ngapi|kiasi gani/i,
        /vault.*balance|treasury.*balance/i,
        /show.*funds|check.*wallet/i
      ]],
      ['submit_proposal', [
        /proposal|nataka kuomba|suggest|propose/i,
        /i want to.*propose|submit.*idea/i,
        /create.*proposal|new.*proposal/i
      ]],
      ['vote', [
        /vote|piga kura|support|i agree|ninapiga kura/i,
        /yes.*proposal|no.*proposal|abstain/i
      ]],
      ['check_proposal', [
        /proposal.*status|check.*proposal|view.*proposal/i,
        /what.*proposals|active.*proposals/i
      ]],
      ['join_dao', [
        /join|become.*member|sign up|niunge/i,
        /how.*join|register|onboard/i
      ]],
      ['help', [
        /help|nisaidie|what can you|commands/i,
        /how do i|guide|tutorial/i
      ]],
      ['analytics', [
        /analytics|statistics|stats|takwimu/i,
        /report|analysis|trends/i
      ]],
      ['community_stats', [
        /community|members|wanachama|participation/i,
        /engagement|activity|growth/i
      ]],
      ['treasury_report', [
        /treasury|funds|budget|fedha/i,
        /financial.*report|spending|expenses/i
      ]],
      ['governance_info', [
        /governance|voting.*power|quorum|utawala/i,
        /how.*voting.*works|proposal.*process/i
      ]]
    ]);
  }

  /**
   * Extract entities from message based on intent
   */
  private extractEntities(message: string, intent: IntentType): Record<string, any> {
    const entities: Record<string, any> = {};

    // Extract amounts (numbers with optional currency)
    const amountMatch = message.match(/(\d+(?:,\d{3})*(?:\.\d{2})?)\s*(kes|usd|celo|ckes)?/i);
    if (amountMatch) {
      entities.amount = parseFloat(amountMatch[1].replace(/,/g, ''));
      if (amountMatch[2]) {
        entities.currency = amountMatch[2].toUpperCase();
      }
    }

    // Extract wallet addresses (0x...)
    const addressMatch = message.match(/0x[a-fA-F0-9]{40}/);
    if (addressMatch) {
      entities.address = addressMatch[0];
    }

    // Extract proposal IDs
    const proposalIdMatch = message.match(/proposal\s*#?(\d+|[a-f0-9-]{36})/i);
    if (proposalIdMatch) {
      entities.proposalId = proposalIdMatch[1];
    }

    // Extract timeframes
    const timeframeMatch = message.match(/(today|yesterday|this week|last week|this month|last month)/i);
    if (timeframeMatch) {
      entities.timeframe = timeframeMatch[1].toLowerCase();
    }

    return entities;
  }

  /**
   * Detect language (basic detection)
   */
  private detectLanguage(message: string): string {
    // Swahili keywords
    const swahiliKeywords = ['nataka', 'pesa', 'ngapi', 'weka', 'toa', 'kiasi', 'kura', 'wanachama', 'fedha'];
    const hasSwahili = swahiliKeywords.some(keyword => message.toLowerCase().includes(keyword));

    return hasSwahili ? 'sw' : 'en';
  }

  /**
   * Basic sentiment analysis
   */
  private analyzeSentiment(message: string): number {
    const positiveWords = ['good', 'great', 'excellent', 'love', 'awesome', 'nzuri', 'poa'];
    const negativeWords = ['bad', 'poor', 'hate', 'terrible', 'awful', 'mbaya'];

    const lowerMessage = message.toLowerCase();
    let sentiment = 0;

    positiveWords.forEach(word => {
      if (lowerMessage.includes(word)) sentiment += 0.2;
    });

    negativeWords.forEach(word => {
      if (lowerMessage.includes(word)) sentiment -= 0.2;
    });

    return Math.max(-1, Math.min(1, sentiment));
  }
}