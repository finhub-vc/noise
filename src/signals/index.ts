/**
 * Signal Generation Module Index
 */

// Core components
export * from './SignalManager.js';
export * from './RegimeDetector.js';
export * from './TimeFilter.js';

// Strategies - export classes directly
export { MomentumStrategy, type MomentumStrategyConfig } from './strategies/MomentumStrategy.js';
export { MeanReversionStrategy, type MeanReversionStrategyConfig } from './strategies/MeanReversionStrategy.js';
export { BreakoutStrategy, type BreakoutStrategyConfig } from './strategies/BreakoutStrategy.js';

// Shared types
export * from './strategies/types.js';

// Indicators
export * from './indicators/indicators.js';
