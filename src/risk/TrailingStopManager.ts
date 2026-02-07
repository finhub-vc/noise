/**
 * Trailing Stop Manager
 * Calculates and updates trailing stop levels for open positions
 */

import { createLogger } from '@/utils/index.js';

const log = createLogger('TRAILING_STOP');

export interface TrailingStopConfig {
  enabled: boolean;
  trailPercent: number; // Percentage to trail behind best price
  activationPercent: number; // Profit required before trailing activates
  minTrailPercent: number; // Minimum trail distance from entry
  updateIntervalSeconds: number;
}

export interface TrailingStopState {
  positionId: string;
  symbol: string;
  side: 'LONG' | 'SHORT';
  entryPrice: number;
  initialStop: number;
  currentStop: number;
  highestPrice: number; // For LONG
  lowestPrice: number; // For SHORT
  activated: boolean;
  lastUpdate: number;
}

const DEFAULT_CONFIG: TrailingStopConfig = {
  enabled: true,
  trailPercent: 0.5, // 0.5% trailing distance
  activationPercent: 0.3, // Activate after 0.3% profit
  minTrailPercent: 0.2, // At least 0.2% from entry
  updateIntervalSeconds: 60,
};

export class TrailingStopManager {
  private stops = new Map<string, TrailingStopState>();
  private config: TrailingStopConfig;

  constructor(config?: Partial<TrailingStopConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.validateConfig(this.config);
  }

  /**
   * Validate configuration values
   * @throws Error if configuration is invalid
   */
  private validateConfig(cfg: TrailingStopConfig): void {
    if (cfg.trailPercent <= 0) {
      const error = new Error('trailPercent must be positive');
      log.error('Invalid trailPercent configuration', error, { trailPercent: cfg.trailPercent });
      throw error;
    }
    if (cfg.activationPercent < 0) {
      const error = new Error('activationPercent must be non-negative');
      log.error('Invalid activationPercent configuration', error, { activationPercent: cfg.activationPercent });
      throw error;
    }
    if (cfg.minTrailPercent <= 0) {
      const error = new Error('minTrailPercent must be positive');
      log.error('Invalid minTrailPercent configuration', error, { minTrailPercent: cfg.minTrailPercent });
      throw error;
    }
    if (cfg.updateIntervalSeconds <= 0) {
      const error = new Error('updateIntervalSeconds must be positive');
      log.error('Invalid updateIntervalSeconds configuration', error, { updateIntervalSeconds: cfg.updateIntervalSeconds });
      throw error;
    }
  }

  /**
   * Add a position to trailing stop management
   */
  addPosition(
    positionId: string,
    symbol: string,
    side: 'LONG' | 'SHORT',
    entryPrice: number,
    initialStop: number
  ): void {
    this.stops.set(positionId, {
      positionId,
      symbol,
      side,
      entryPrice,
      initialStop,
      currentStop: initialStop,
      highestPrice: side === 'LONG' ? entryPrice : 0,
      lowestPrice: side === 'SHORT' ? entryPrice : Infinity,
      activated: false,
      lastUpdate: Date.now(),
    });

    log.info('Trailing stop initialized', {
      positionId,
      symbol,
      side,
      entryPrice,
      initialStop,
    });
  }

  /**
   * Remove a position from trailing stop management
   */
  removePosition(positionId: string): void {
    this.stops.delete(positionId);
    log.debug('Trailing stop removed', { positionId });
  }

  /**
   * Calculate new stop level based on current price
   */
  calculateNewStop(currentPrice: number, state: TrailingStopState): number | null {
    const { side, entryPrice, initialStop, highestPrice, lowestPrice } = state;

    // Validate inputs to prevent NaN/Infinity from invalid prices
    if (currentPrice <= 0 || entryPrice <= 0 || initialStop <= 0) {
      log.error('Invalid price values for trailing stop calculation', undefined, {
        positionId: state.positionId,
        currentPrice,
        entryPrice,
        initialStop,
      });
      return null;
    }

    const profitPercent = side === 'LONG'
      ? (currentPrice - entryPrice) / entryPrice * 100
      : (entryPrice - currentPrice) / entryPrice * 100;

    // Check if trailing should activate
    if (!state.activated && profitPercent >= this.config.activationPercent) {
      state.activated = true;
      log.info('Trailing stop activated', {
        positionId: state.positionId,
        profitPercent: profitPercent.toFixed(2),
      });
    }

    if (!state.activated) {
      return initialStop; // Return initial stop until activation
    }

    // Calculate trail distance
    const trailDistance = currentPrice * (this.config.trailPercent / 100);

    // Ensure minimum trail from entry
    const minTrailPrice = side === 'LONG'
      ? entryPrice * (1 + this.config.minTrailPercent / 100)
      : entryPrice * (1 - this.config.minTrailPercent / 100);

    let newStop: number;

    if (side === 'LONG') {
      // Use current or highest price for trailing
      const trailingPrice = Math.max(currentPrice, highestPrice);
      // Set stop below highest price
      newStop = Math.max(
        trailingPrice - trailDistance,
        minTrailPrice
      );
      // Never lower stop below initial
      newStop = Math.max(newStop, initialStop);
    } else {
      // Use current or lowest price for trailing
      const trailingPrice = Math.min(currentPrice, lowestPrice);
      // Set stop above lowest price
      newStop = Math.min(
        trailingPrice + trailDistance,
        minTrailPrice
      );
      // Never raise stop above initial
      newStop = Math.min(newStop, initialStop);
    }

    return newStop;
  }

  /**
   * Update trailing stops based on current prices
   */
  updateStops(currentPrices: Map<string, number>): Map<string, { oldStop: number; newStop: number }> {
    const updates = new Map<string, { oldStop: number; newStop: number }>();

    for (const [positionId, state] of this.stops.entries()) {
      const currentPrice = currentPrices.get(state.symbol);
      if (!currentPrice) {
        log.warn('Skipping trailing stop update: no price data', {
          positionId,
          symbol: state.symbol,
        });
        continue;
      }

      // Update highest/lowest tracking
      if (state.side === 'LONG') {
        if (currentPrice > state.highestPrice) {
          state.highestPrice = currentPrice;
        }
      } else {
        if (currentPrice < state.lowestPrice) {
          state.lowestPrice = currentPrice;
        }
      }

      const oldStop = state.currentStop;
      const newStop = this.calculateNewStop(currentPrice, state);

      if (newStop !== null) {
        // Only update if stop moved favorably
        const favorable = state.side === 'LONG' ? newStop > oldStop : newStop < oldStop;
        if (favorable) {
          state.currentStop = newStop;
          state.lastUpdate = Date.now();
          updates.set(positionId, { oldStop, newStop });
          log.debug('Trailing stop updated', {
            positionId,
            oldStop: oldStop.toFixed(2),
            newStop: newStop.toFixed(2),
          });
        }
      }
    }

    return updates;
  }

  /**
   * Get current stop level for a position
   */
  getStopLevel(positionId: string): number | null {
    const state = this.stops.get(positionId);
    return state ? state.currentStop : null;
  }

  /**
   * Get all trailing stop states
   */
  getAllStops(): Map<string, TrailingStopState> {
    return new Map(this.stops);
  }

  /**
   * Check if stop should be triggered
   */
  checkTrigger(positionId: string, currentPrice: number): boolean {
    const state = this.stops.get(positionId);
    if (!state) return false;

    if (state.side === 'LONG') {
      return currentPrice <= state.currentStop;
    } else {
      return currentPrice >= state.currentStop;
    }
  }

  /**
   * Update configuration
   */
  updateConfig(updates: Partial<TrailingStopConfig>): void {
    this.config = { ...this.config, ...updates };
    this.validateConfig(this.config);
    log.info('Trailing stop config updated', { updates });
  }

  /**
   * Get configuration
   */
  getConfig(): TrailingStopConfig {
    return { ...this.config };
  }
}
