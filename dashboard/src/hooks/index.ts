/**
 * Hooks Module Exports
 */

export { useAccount } from './useAccount';
export type { AccountData } from './useAccount';

export { usePositions } from './usePositions';
export type { Position } from './usePositions';

export { useSignals } from './useSignals';
export type { Signal } from './useSignals';

export { useTrades } from './useTrades';
export type { Trade } from './useTrades';

export { usePerformance, useEquityCurve } from './usePerformance';
export type {
  PerformanceData,
  PerformanceSummary,
  EquityPoint,
} from './usePerformance';

export {
  useWebSocket,
  useRealtimePositions,
  useRealtimeSignals,
} from './useWebSocket';
