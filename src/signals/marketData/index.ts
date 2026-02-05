/**
 * Market Data Module Exports
 */

export {
  MarketDataProvider,
  RestMarketDataProvider,
  MockMarketDataProvider,
  setMarketDataProvider,
  getMarketDataProvider,
  type OHLCV,
  type Quote,
  type MarketDataOptions,
} from './MarketDataProvider.js';

export {
  HistoricalDataFetcher,
  getHistoricalDataFetcher,
} from './HistoricalDataFetcher.js';

export {
  RealTimeDataFeed,
  getRealTimeDataFeed,
  resetRealTimeDataFeed,
  startRealTimeFeed,
  type RealtimeConfig,
  type RealtimeUpdate,
  type UpdateCallback,
} from './RealTimeDataFeed.js';
