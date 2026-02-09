/**
 * Sentiment Analyzer
 * Analyzes news headlines and text to determine bullish/bearish sentiment
 */

import type {
  SentimentDirection,
  SentimentScore,
  SentimentFactor,
  SentimentConfig,
  NewsItem,
  MarketSentimentIndices,
  MarketSentimentScore,
} from './types.js';
import {
  BULLISH_KEYWORDS,
  BEARISH_KEYWORDS,
  DEFAULT_SENTIMENT_CONFIG,
} from './types.js';
import { createLogger } from '../utils/index.js';

const log = createLogger('SENTIMENT_ANALYZER');

export class SentimentAnalyzer {
  constructor(private config: SentimentConfig = DEFAULT_SENTIMENT_CONFIG) {}

  /**
   * Analyze a single news headline/description
   */
  analyzeNews(title: string, description?: string): SentimentScore {
    const text = `${title} ${description || ''}`.toLowerCase();
    const factors: SentimentFactor[] = [];

    // Count bullish and bearish keyword matches
    let bullishCount = 0;
    let bearishCount = 0;

    for (const keyword of BULLISH_KEYWORDS) {
      const regex = new RegExp(`\\b${keyword}\\b`, 'gi');
      const matches = text.match(regex);
      if (matches) {
        bullishCount += matches.length;
        factors.push({
          type: 'KEYWORD',
          weight: 0.3,
          value: matches.length * 0.3,
          description: `Bullish keyword: ${keyword}`,
        });
      }
    }

    for (const keyword of BEARISH_KEYWORDS) {
      const regex = new RegExp(`\\b${keyword}\\b`, 'gi');
      const matches = text.match(regex);
      if (matches) {
        bearishCount += matches.length;
        factors.push({
          type: 'KEYWORD',
          weight: 0.3,
          value: -matches.length * 0.3,
          description: `Bearish keyword: ${keyword}`,
        });
      }
    }

    // Analyze headline sentiment (capitalization, punctuation)
    const headlineScore = this.analyzeHeadlinePatterns(title);
    if (headlineScore !== 0) {
      factors.push({
        type: 'HEADLINE',
        weight: 0.1,
        value: headlineScore,
        description: 'Headline pattern analysis',
      });
    }

    // Calculate overall score
    const rawScore = (bullishCount - bearishCount) * 0.3 + headlineScore;
    const normalizedScore = Math.max(-1, Math.min(1, rawScore));

    // Determine direction
    let direction: SentimentDirection = 'NEUTRAL';
    if (normalizedScore > 0.2) direction = 'BULLISH';
    else if (normalizedScore < -0.2) direction = 'BEARISH';

    // Calculate confidence based on keyword density
    const totalKeywords = bullishCount + bearishCount;
    const confidence = Math.min(1, totalKeywords * 0.2 + 0.3);

    return {
      direction,
      score: normalizedScore,
      confidence,
      factors,
    };
  }

  /**
   * Analyze multiple news items and aggregate sentiment
   */
  analyzeNewsSentiment(news: NewsItem[]): SentimentScore {
    if (news.length === 0) {
      return {
        direction: 'NEUTRAL',
        score: 0,
        confidence: 0,
        factors: [],
      };
    }

    const scores = news.map((item) => item.sentiment.score);
    const avgScore = scores.reduce((a, b) => a + b, 0) / scores.length;

    // Count directional signals
    const bullishCount = news.filter((n) => n.sentiment.direction === 'BULLISH').length;
    const bearishCount = news.filter((n) => n.sentiment.direction === 'BEARISH').length;
    const totalSignals = news.length;

    // Confidence increases with more news and agreement
    const agreement = 1 - Math.abs(bullishCount - bearishCount) / totalSignals;
    const volumeConfidence = Math.min(1, totalSignals * 0.15);
    const confidence = Math.max(0.3, agreement * volumeConfidence);

    // Determine direction
    let direction: SentimentDirection = 'NEUTRAL';
    if (avgScore > 0.15) direction = 'BULLISH';
    else if (avgScore < -0.15) direction = 'BEARISH';

    return {
      direction,
      score: avgScore,
      confidence,
      factors: [
        {
          type: 'VOLUME',
          weight: 0.5,
          value: volumeConfidence,
          description: `${totalSignals} news items analyzed`,
        },
        {
          type: 'HEADLINE',
          weight: 0.5,
          value: avgScore,
          description: `Average sentiment score: ${avgScore.toFixed(2)}`,
        },
      ],
    };
  }

  /**
   * Analyze market indices (VIX, Put/Call, Fear & Greed)
   */
  analyzeMarketIndices(indices: MarketSentimentIndices): MarketSentimentScore {
    let score = 0;
    let fearGreed: MarketSentimentScore['fearGreed'] = null;
    let vixLevel: MarketSentimentScore['vixLevel'] = null;

    // VIX Analysis (inverse relationship - high VIX = bearish)
    if (indices.vix !== null) {
      const vix = indices.vix;
      if (vix < 12) {
        vixLevel = 'LOW';
        score += 0.3; // Very low volatility = bullish
      } else if (vix < 20) {
        vixLevel = 'NORMAL';
        score += 0.1; // Normal volatility
      } else if (vix < 30) {
        vixLevel = 'ELEVATED';
        score -= 0.2; // Elevated volatility = somewhat bearish
      } else {
        vixLevel = 'HIGH';
        score -= 0.5; // High volatility = bearish
      }
    }

    // Put/Call Ratio Analysis (high ratio = bearish)
    if (indices.putCallRatio !== null) {
      const pcr = indices.putCallRatio;
      if (pcr < 0.7) {
        score += 0.2; // Low ratio = bullish (too much optimism)
      } else if (pcr > 1.0) {
        score -= 0.2; // High ratio = bearish (fear/hedging)
      }
      // 0.7-1.0 is neutral
    }

    // Fear & Greed Index Analysis
    if (indices.fearGreedIndex !== null) {
      const fg = indices.fearGreedIndex;
      if (fg <= 20) {
        fearGreed = 'EXTREME_FEAR';
        score += 0.3; // Contrarian bullish signal
      } else if (fg <= 40) {
        fearGreed = 'FEAR';
        score += 0.15;
      } else if (fg >= 80) {
        fearGreed = 'EXTREME_GREED';
        score -= 0.3; // Contrarian bearish signal
      } else if (fg >= 60) {
        fearGreed = 'GREED';
        score -= 0.15;
      } else {
        fearGreed = 'NEUTRAL';
      }
    }

    // Normalize score to -1 to 1
    score = Math.max(-1, Math.min(1, score));

    let overall: SentimentDirection = 'NEUTRAL';
    if (score > 0.2) overall = 'BULLISH';
    else if (score < -0.2) overall = 'BEARISH';

    return {
      overall,
      fearGreed,
      vixLevel,
      score,
    };
  }

  /**
   * Check if sentiment conflicts with signal direction
   */
  isConflicting(
    signalDirection: 'LONG' | 'SHORT',
    sentimentScore: SentimentScore
  ): boolean {
    if (!this.config.enabled) return false;

    const { direction, score, confidence } = sentimentScore;

    // Low confidence doesn't conflict
    if (confidence < this.config.minConfidence) return false;

    // Strong bearish conflicts with LONG
    if (signalDirection === 'LONG' && direction === 'BEARISH') {
      return Math.abs(score) > this.config.conflictingThreshold;
    }

    // Strong bullish conflicts with SHORT
    if (signalDirection === 'SHORT' && direction === 'BULLISH') {
      return Math.abs(score) > this.config.conflictingThreshold;
    }

    return false;
  }

  /**
   * Adjust signal strength based on sentiment
   */
  adjustSignalStrength(
    originalStrength: number,
    signalDirection: 'LONG' | 'SHORT',
    sentimentScore: SentimentScore
  ): number {
    if (!this.config.enabled) return originalStrength;

    const { direction, score, confidence } = sentimentScore;

    // Low confidence - no adjustment
    if (confidence < this.config.minConfidence) return originalStrength;

    // Sentiment aligns with signal - increase strength
    const aligns =
      (signalDirection === 'LONG' && direction === 'BULLISH') ||
      (signalDirection === 'SHORT' && direction === 'BEARISH');

    if (aligns) {
      const boost = Math.abs(score) * confidence * 0.3; // Up to 30% boost
      return Math.min(1, originalStrength + boost);
    }

    // Sentiment conflicts - reduce strength
    const conflicts =
      (signalDirection === 'LONG' && direction === 'BEARISH') ||
      (signalDirection === 'SHORT' && direction === 'BULLISH');

    if (conflicts) {
      const penalty = Math.abs(score) * confidence * 0.5; // Up to 50% penalty
      return Math.max(0, originalStrength - penalty);
    }

    return originalStrength;
  }

  /**
   * Analyze headline patterns (exclamation marks, caps, etc.)
   */
  private analyzeHeadlinePatterns(headline: string): number {
    let score = 0;

    // Excessive caps might indicate hype (negative/reduce score)
    const upperCaseRatio = (headline.match(/[A-Z]/g) || []).length / headline.length;
    if (upperCaseRatio > 0.5) {
      score -= 0.1;
    }

    // Multiple exclamation marks = hype (negative)
    const exclamationCount = (headline.match(/!/g) || []).length;
    if (exclamationCount > 1) {
      score -= 0.1 * exclamationCount;
    }

    return score;
  }
}

// =============================================================================
// Global Singleton
// =============================================================================

let globalAnalyzer: SentimentAnalyzer | null = null;

export function getSentimentAnalyzer(config?: SentimentConfig): SentimentAnalyzer {
  if (!globalAnalyzer) {
    globalAnalyzer = new SentimentAnalyzer(config);
  }
  return globalAnalyzer;
}
