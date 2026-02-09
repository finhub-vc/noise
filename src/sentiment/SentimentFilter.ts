/**
 * Sentiment Filter
 * Filters and adjusts trading signals based on sentiment analysis
 */

import type { SentimentDirection, SentimentScore, SentimentSummary, SentimentConfig } from './types.js';
import { getSentimentAnalyzer } from './SentimentAnalyzer.js';
import { getNewsManager } from './NewsProvider.js';
import { createLogger } from '../utils/index.js';

const log = createLogger('SENTIMENT_FILTER');

export interface SentimentFilterResult {
  shouldBlock: boolean;
  adjustedStrength: number;
  sentiment: SentimentSummary;
  reason?: string;
}

export interface SentimentFilterOptions {
  blockOnConflicting: boolean;
  minSentimentScore: number;
  adjustStrength: boolean;
}

export class SentimentFilter {
  private cache = new Map<string, { summary: SentimentSummary; timestamp: number }>();
  private readonly CACHE_TTL = 15 * 60 * 1000; // 15 minutes

  constructor(
    private config: SentimentConfig,
    private options: SentimentFilterOptions = {
      blockOnConflicting: true,
      minSentimentScore: -0.7, // Allow moderately bearish for LONG
      adjustStrength: true,
    }
  ) {}

  /**
   * Filter a trading signal based on sentiment
   */
  async filterSignal(
    symbol: string,
    direction: 'LONG' | 'SHORT',
    strength: number
  ): Promise<SentimentFilterResult> {
    const analyzer = getSentimentAnalyzer(this.config);

    // Get sentiment summary for symbol
    const sentiment = await this.getSentimentSummary(symbol);

    // Check if sentiment should block the signal
    let shouldBlock = false;
    let reason: string | undefined;

    if (this.config.enabled && sentiment.newsCount >= 2) {
      // Strong conflicting sentiment
      if (this.options.blockOnConflicting) {
        if (direction === 'LONG' && sentiment.overallSentiment === 'BEARISH') {
          if (sentiment.strongSignal && sentiment.overallScore < -0.5) {
            shouldBlock = true;
            reason = `Strong bearish news (${sentiment.overallScore.toFixed(2)}) conflicts with LONG signal`;
          }
        } else if (direction === 'SHORT' && sentiment.overallSentiment === 'BULLISH') {
          if (sentiment.strongSignal && sentiment.overallScore > 0.5) {
            shouldBlock = true;
            reason = `Strong bullish news (${sentiment.overallScore.toFixed(2)}) conflicts with SHORT signal`;
          }
        }
      }

      // Check minimum sentiment score
      if (direction === 'LONG' && sentiment.overallScore < this.options.minSentimentScore) {
        shouldBlock = true;
        reason = `Sentiment score (${sentiment.overallScore.toFixed(2)}) below minimum (${this.options.minSentimentScore})`;
      }
      if (direction === 'SHORT' && sentiment.overallScore > -this.options.minSentimentScore) {
        shouldBlock = true;
        reason = `Sentiment score (${sentiment.overallScore.toFixed(2)}) above maximum (${-this.options.minSentimentScore})`;
      }
    }

    // Adjust signal strength based on sentiment
    let adjustedStrength = strength;
    if (this.options.adjustStrength && !shouldBlock) {
      const sentimentScore: SentimentScore = {
        direction: sentiment.overallSentiment,
        score: sentiment.overallScore,
        confidence: Math.min(1, sentiment.newsCount * 0.2),
        factors: [],
      };
      adjustedStrength = analyzer.adjustSignalStrength(strength, direction, sentimentScore);
    }

    return {
      shouldBlock,
      adjustedStrength,
      sentiment,
      reason,
    };
  }

  /**
   * Get sentiment summary for a symbol
   */
  async getSentimentSummary(symbol: string): Promise<SentimentSummary> {
    // Check cache
    const cached = this.cache.get(symbol);
    if (cached && Date.now() - cached.timestamp < this.CACHE_TTL) {
      return cached.summary;
    }

    const analyzer = getSentimentAnalyzer(this.config);
    const newsManager = getNewsManager();

    // Fetch recent news
    const news = await newsManager.fetchNews({
      symbols: [symbol],
      limit: 20,
    });

    if (news.length === 0) {
      const emptySummary: SentimentSummary = {
        symbol,
        overallSentiment: 'NEUTRAL',
        overallScore: 0,
        newsCount: 0,
        avgSentiment: 0,
        strongSignal: false,
        conflicting: false,
        lastUpdated: Date.now(),
      };
      this.cache.set(symbol, { summary: emptySummary, timestamp: Date.now() });
      return emptySummary;
    }

    // Analyze sentiment
    const sentiment = analyzer.analyzeNewsSentiment(news);

    // Check for conflicting signals (mix of bullish and bearish)
    const bullishCount = news.filter((n) => n.sentiment.direction === 'BULLISH').length;
    const bearishCount = news.filter((n) => n.sentiment.direction === 'BEARISH').length;
    const total = bullishCount + bearishCount;

    // Conflicting if both sides have significant representation
    const conflicting = total > 3 &&
      bullishCount >= total * 0.3 &&
      bearishCount >= total * 0.3;

    const summary: SentimentSummary = {
      symbol,
      overallSentiment: sentiment.direction,
      overallScore: sentiment.score,
      newsCount: news.length,
      avgSentiment: sentiment.score,
      strongSignal: Math.abs(sentiment.score) > this.config.strongSignalThreshold,
      conflicting,
      lastUpdated: Date.now(),
    };

    // Cache result
    this.cache.set(symbol, { summary, timestamp: Date.now() });

    return summary;
  }

  /**
   * Get sentiment summaries for multiple symbols
   */
  async getSentimentSummaries(symbols: string[]): Promise<Map<string, SentimentSummary>> {
    const results = new Map<string, SentimentSummary>();

    await Promise.all(
      symbols.map(async (symbol) => {
        const summary = await this.getSentimentSummary(symbol);
        results.set(symbol, summary);
      })
    );

    return results;
  }

  /**
   * Clear the sentiment cache
   */
  clearCache(): void {
    this.cache.clear();
  }
}

// =============================================================================
// Global Singleton
// =============================================================================

let globalFilter: SentimentFilter | null = null;

export function getSentimentFilter(): SentimentFilter {
  if (!globalFilter) {
    globalFilter = new SentimentFilter({
      enabled: true,
      minConfidence: 0.5,
      strongSignalThreshold: 0.5,
      conflictingThreshold: 0.3,
      newsLookbackHours: 24,
      sources: { news: true, social: false, marketIndices: false },
      weights: { news: 1.0, social: 0.5, marketIndices: 0.3 },
    });
  }
  return globalFilter;
}

export function setSentimentFilter(filter: SentimentFilter): void {
  globalFilter = filter;
}
