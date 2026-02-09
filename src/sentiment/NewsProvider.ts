/**
 * News Provider
 * Fetches news from various sources and provides standardized interface
 */

import type { NewsItem, SentimentScore } from './types.js';
import { getSentimentAnalyzer } from './SentimentAnalyzer.js';
import { createLogger } from '../utils/index.js';

const log = createLogger('NEWS_PROVIDER');

// Configuration
const NEWS_CACHE_TTL = 5 * 60 * 1000; // 5 minutes
const MAX_NEWS_PER_SYMBOL = 20;

export interface NewsProviderConfig {
  enabled: boolean;
  apiKey?: string;
  sources: string[];
  cacheEnabled: boolean;
  lookbackHours: number;
}

export interface FetchNewsOptions {
  symbols: string[];
  limit?: number;
  startTime?: number;
  endTime?: number;
}

/**
 * News Provider Interface
 */
export abstract class NewsProvider {
  abstract fetchNews(options: FetchNewsOptions): Promise<NewsItem[]>;
  abstract testConnection(): Promise<boolean>;
}

/**
 * NewsAPI.org Provider
 * Free tier: 100 requests/day, 1 month history
 */
export class NewsApiProvider extends NewsProvider {
  private readonly baseUrl = 'https://newsapi.org/v2';

  constructor(
    private apiKey: string,
    private fetchFn: typeof fetch = fetch
  ) {
    super();
  }

  async fetchNews(options: FetchNewsOptions): Promise<NewsItem[]> {
    const { symbols, limit = MAX_NEWS_PER_SYMBOL } = options;

    const allNews: NewsItem[] = [];

    for (const symbol of symbols) {
      try {
        const url = new URL(`${this.baseUrl}/everything`);
        url.searchParams.set('q', `${symbol} stock OR ${symbol} shares`);
        url.searchParams.set('apiKey', this.apiKey);
        url.searchParams.set('pageSize', limit.toString());
        url.searchParams.set('sortBy', 'publishedAt');
        url.searchParams.set('language', 'en');

        // Add time range if specified
        const endTime = options.endTime || Date.now();
        const startTime = options.startTime || endTime - 24 * 60 * 60 * 1000;
        url.searchParams.set('from', new Date(startTime).toISOString());
        url.searchParams.set('to', new Date(endTime).toISOString());

        const response = await this.fetchFn(url.toString());

        if (!response.ok) {
          if (response.status === 401) {
            log.error('NewsAPI authentication failed - check API key');
          }
          continue;
        }

        const data = await response.json() as NewsApiResponse;

        if (data.status === 'ok' && data.articles) {
          const newsItems = data.articles
            .filter((article) => article.title && article.title !== '[Removed]')
            .map((article) => this.mapArticle(symbol, article));

          allNews.push(...newsItems);
        }
      } catch (error) {
        log.error(`Failed to fetch news for ${symbol}`, error as Error);
      }
    }

    return allNews;
  }

  async testConnection(): Promise<boolean> {
    try {
      const url = new URL(`${this.baseUrl}/top-headlines`);
      url.searchParams.set('apiKey', this.apiKey);
      url.searchParams.set('pageSize', '1');
      url.searchParams.set('category', 'business');

      const response = await this.fetchFn(url.toString());
      return response.ok;
    } catch {
      return false;
    }
  }

  private mapArticle(symbol: string, article: Article): NewsItem {
    const analyzer = getSentimentAnalyzer();
    const sentiment = analyzer.analyzeNews(article.title, article.description);

    return {
      id: `newsapi-${article.publishedAt}-${symbol}-${Math.random().toString(36).substr(2, 9)}`,
      symbol,
      title: article.title,
      description: article.description || undefined,
      url: article.url,
      source: article.source.name,
      publishedAt: new Date(article.publishedAt).getTime(),
      sentiment,
    };
  }
}

/**
 * Alpha Vantage News Provider
 * Free tier: 25 requests/day, global news
 */
export class AlphaVantageNewsProvider extends NewsProvider {
  private readonly baseUrl = 'https://www.alphavantage.co/query';

  constructor(
    private apiKey: string,
    private fetchFn: typeof fetch = fetch
  ) {
    super();
  }

  async fetchNews(options: FetchNewsOptions): Promise<NewsItem[]> {
    const { symbols } = options;

    const url = new URL(this.baseUrl);
    url.searchParams.set('function', 'NEWS_SENTIMENT');
    url.searchParams.set('tickers', symbols.join(','));
    url.searchParams.set('apikey', this.apiKey);
    url.searchParams.set('limit', '100');

    // Add time range
    const endTime = options.endTime || Date.now();
    const startTime = options.startTime || endTime - 24 * 60 * 60 * 1000;
    url.searchParams.set('time_from', new Date(startTime).toISOString());
    url.searchParams.set('time_to', new Date(endTime).toISOString());

    try {
      const response = await this.fetchFn(url.toString());

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const data = await response.json() as AlphaVantageNewsResponse;

      if (data.feed) {
        return data.feed.map((article) => this.mapArticle(article));
      }

      return [];
    } catch (error) {
      log.error('Failed to fetch Alpha Vantage news', error as Error);
      return [];
    }
  }

  async testConnection(): Promise<boolean> {
    try {
      const url = new URL(this.baseUrl);
      url.searchParams.set('function', 'NEWS_SENTIMENT');
      url.searchParams.set('tickers', 'AAPL');
      url.searchParams.set('apikey', this.apiKey);
      url.searchParams.set('limit', '1');

      const response = await this.fetchFn(url.toString());
      return response.ok;
    } catch {
      return false;
    }
  }

  private mapArticle(article: AlphaVantageArticle): NewsItem {
    const analyzer = getSentimentAnalyzer();
    const sentiment = analyzer.analyzeNews(article.title, article.summary);

    return {
      id: `av-${article.time_published}-${article.ticker_symbol}`,
      symbol: article.ticker_symbol,
      title: article.title,
      description: article.summary,
      url: article.url,
      source: article.source,
      publishedAt: new Date(article.time_published).getTime(),
      sentiment,
    };
  }
}

/**
 * Mock News Provider (for testing/demonstration)
 */
export class MockNewsProvider extends NewsProvider {
  private mockNews: NewsItem[] = [
    {
      id: 'mock-1',
      symbol: 'TSLA',
      title: 'Tesla Stock Surges as EV Demand Shows Strong Growth',
      description: 'Electric vehicle demand continues to rise as Tesla beats expectations.',
      url: 'https://example.com/news/1',
      source: 'Mock Financial',
      publishedAt: Date.now() - 60 * 60 * 1000,
      sentiment: {
        direction: 'BULLISH',
        score: 0.6,
        confidence: 0.7,
        factors: [],
      },
    },
    {
      id: 'mock-2',
      symbol: 'AAPL',
      title: 'Apple Faces Headwinds amid Supply Chain Concerns',
      description: 'Analysts warn of potential production delays affecting iPhone sales.',
      url: 'https://example.com/news/2',
      source: 'Mock Financial',
      publishedAt: Date.now() - 120 * 60 * 1000,
      sentiment: {
        direction: 'BEARISH',
        score: -0.5,
        confidence: 0.6,
        factors: [],
      },
    },
    {
      id: 'mock-3',
      symbol: 'NVDA',
      title: 'NVIDIA Reaches Record High on AI Chip Demand',
      description: 'Data center spending drives strong quarterly results for NVIDIA.',
      url: 'https://example.com/news/3',
      source: 'Mock Financial',
      publishedAt: Date.now() - 30 * 60 * 1000,
      sentiment: {
        direction: 'BULLISH',
        score: 0.8,
        confidence: 0.85,
        factors: [],
      },
    },
  ];

  async fetchNews(options: FetchNewsOptions): Promise<NewsItem[]> {
    // Return mock news for requested symbols
    return this.mockNews.filter((item) =>
      options.symbols.includes(item.symbol)
    );
  }

  async testConnection(): Promise<boolean> {
    return true;
  }
}

/**
 * News Manager - Caches and aggregates news from multiple providers
 */
export class NewsManager {
  private cache = new Map<string, { news: NewsItem[]; timestamp: number }>();

  constructor(
    private providers: NewsProvider[] = [],
    private config: NewsProviderConfig = {
      enabled: true,
      cacheEnabled: true,
      lookbackHours: 24,
    }
  ) {}

  async fetchNews(options: FetchNewsOptions): Promise<NewsItem[]> {
    if (!this.config.enabled || this.providers.length === 0) {
      return [];
    }

    const cacheKey = this.getCacheKey(options);

    // Check cache
    if (this.config.cacheEnabled) {
      const cached = this.cache.get(cacheKey);
      if (cached && Date.now() - cached.timestamp < NEWS_CACHE_TTL) {
        return cached.news;
      }
    }

    // Fetch from all providers
    const allNews: NewsItem[] = [];

    for (const provider of this.providers) {
      try {
        const news = await provider.fetchNews(options);
        allNews.push(...news);
      } catch (error) {
        log.error('Provider failed to fetch news', error as Error);
      }
    }

    // Deduplicate and sort by date
    const uniqueNews = this.deduplicateNews(allNews);
    uniqueNews.sort((a, b) => b.publishedAt - a.publishedAt);

    // Cache result
    if (this.config.cacheEnabled) {
      this.cache.set(cacheKey, { news: uniqueNews, timestamp: Date.now() });
    }

    return uniqueNews;
  }

  async testConnections(): Promise<Map<string, boolean>> {
    const results = new Map<string, boolean>();

    for (const provider of this.providers) {
      const name = provider.constructor.name;
      try {
        results.set(name, await provider.testConnection());
      } catch {
        results.set(name, false);
      }
    }

    return results;
  }

  clearCache(): void {
    this.cache.clear();
  }

  private deduplicateNews(news: NewsItem[]): NewsItem[] {
    const seen = new Set<string>();
    return news.filter((item) => {
      // Use URL as unique identifier
      if (seen.has(item.url)) {
        return false;
      }
      seen.add(item.url);
      return true;
    });
  }

  private getCacheKey(options: FetchNewsOptions): string {
    return `${options.symbols.sort().join(',')}-${options.limit || 'default'}-${options.startTime || 'default'}-${options.endTime || 'default'}`;
  }
}

// =============================================================================
// Global Singleton
// =============================================================================

let globalNewsManager: NewsManager | null = null;

export function getNewsManager(): NewsManager {
  if (!globalNewsManager) {
    // Default to mock provider if no API keys configured
    globalNewsManager = new NewsManager([new MockNewsProvider()]);
  }
  return globalNewsManager;
}

export function setNewsManager(manager: NewsManager): void {
  globalNewsManager = manager;
}

// =============================================================================
// API Response Types
// =============================================================================

interface NewsApiResponse {
  status: 'ok' | 'error';
  articles?: Article[];
  code?: string;
  message?: string;
}

interface Article {
  source: { name: string };
  author?: string;
  title: string;
  description?: string;
  url: string;
  urlToImage?: string;
  publishedAt: string;
  content?: string;
}

interface AlphaVantageNewsResponse {
  feed?: AlphaVantageArticle[];
}

interface AlphaVantageArticle {
  title: string;
  url: string;
  time_published: string;
  source: string;
  summary: string;
  ticker_symbol: string;
}
