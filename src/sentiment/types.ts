/**
 * Sentiment Analysis Types
 */

export type SentimentDirection = 'BULLISH' | 'BEARISH' | 'NEUTRAL';
export type SentimentSource = 'NEWS' | 'SOCIAL' | 'MARKET_INDICES' | 'COMPOSITE';

export interface NewsItem {
  id: string;
  symbol: string;
  title: string;
  description?: string;
  url: string;
  source: string;
  publishedAt: number;
  sentiment: SentimentScore;
}

export interface SentimentScore {
  direction: SentimentDirection;
  score: number; // -1 to 1, negative = bearish, positive = bullish
  confidence: number; // 0 to 1
  factors: SentimentFactor[];
}

export interface SentimentFactor {
  type: 'KEYWORD' | 'HEADLINE' | 'SOURCE' | 'VOLUME' | 'MARKET_INDEX';
  weight: number;
  value: number;
  description: string;
}

export interface SentimentSummary {
  symbol: string;
  overallSentiment: SentimentDirection;
  overallScore: number;
  newsCount: number;
  avgSentiment: number;
  strongSignal: boolean; // |score| > 0.5
  conflicting: boolean; // Mixed bullish/bearish signals
  lastUpdated: number;
}

export interface SentimentConfig {
  enabled: boolean;
  minConfidence: number;
  strongSignalThreshold: number;
  conflictingThreshold: number;
  newsLookbackHours: number;
  sources: {
    news: boolean;
    social: boolean;
    marketIndices: boolean;
  };
  weights: {
    news: number;
    social: number;
    marketIndices: number;
  };
}

export const DEFAULT_SENTIMENT_CONFIG: SentimentConfig = {
  enabled: true,
  minConfidence: 0.5,
  strongSignalThreshold: 0.5,
  conflictingThreshold: 0.3,
  newsLookbackHours: 24,
  sources: {
    news: true,
    social: false,
    marketIndices: false,
  },
  weights: {
    news: 1.0,
    social: 0.5,
    marketIndices: 0.3,
  },
};

// Sentiment keywords for analysis
export const BULLISH_KEYWORDS = [
  'surge', 'rally', 'gain', 'rises', 'soars', 'jumps', 'climbs',
  'beat', 'tops', 'exceeds', 'strong', 'bullish', 'uptrend',
  'breakout', 'momentum', 'growth', 'expansion', 'record', 'high',
  'upgrade', 'outperform', 'buy', 'overweight', 'positive',
  'rallying', 'rallied', 'advances', 'gained', 'higher', 'upside',
];

export const BEARISH_KEYWORDS = [
  'plunge', 'drop', 'fall', 'decline', 'slump', 'tumbles', 'dives',
  'miss', 'below', 'weak', 'bearish', 'downtrend', 'sell-off',
  'concern', 'risk', 'warning', 'downgrade', 'underperform', 'sell',
  'negative', 'losses', 'lower', 'downside', 'collapse', 'crash',
  'plunged', 'dropped', 'declined', 'falling', 'weakness',
];

// Market sentiment indices
export interface MarketSentimentIndices {
  vix: number | null; // CBOE Volatility Index
  putCallRatio: number | null; // Put/Call Ratio
  fearGreedIndex: number | null; // CNN Fear & Greed (0-100)
  timestamp: number;
}

export interface MarketSentimentScore {
  overall: SentimentDirection;
  fearGreed: 'EXTREME_FEAR' | 'FEAR' | 'NEUTRAL' | 'GREED' | 'EXTREME_GREED' | null;
  vixLevel: 'LOW' | 'NORMAL' | 'ELEVATED' | 'HIGH' | null;
  score: number; // -1 to 1
}
