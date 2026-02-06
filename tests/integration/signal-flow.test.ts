/**
 * Integration Tests for Signal Flow
 *
 * Note: These tests require the market-data-integration PR to be merged first
 * as they depend on MarketDataProvider and related modules.
 */

import { describe, it, expect } from 'vitest';

describe.skip('Signal Generation Flow', () => {
  // Integration tests are skipped because MarketDataProvider
  // is in a separate PR (feat/market-data-integration)
  // These tests will be enabled after both PRs are merged.

  it('placeholder - test after merging market-data-integration PR', () => {
    expect(true).toBe(true);
  });

  // TODO: Re-enable the following tests after market-data-integration PR merges:
  // - creates a SignalManager instance
  // - accepts valid config
  // - works with MockMarketDataProvider
  // - fetches historical data from mock provider
});
