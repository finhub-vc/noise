/**
 * Risk Manager
 * Main orchestrator for all risk checks
 */

import type {
  RiskConfig,
  RiskEvaluation,
  PositionSize,
  ExposureCheck,
  CircuitBreakerStatus,
  RiskCheck,
} from '@/types/risk.js';
import type { Signal } from '@/types/index.js';
import type { AggregatedAccount, UnifiedPosition } from '@/types/index.js';
import { DEFAULT_RISK_CONFIG } from '@/config/risk.js';
import { createLogger, roundTo } from '@/utils/index.js';

const log = createLogger('RISK_MANAGER');

export class RiskManager {
  private config: RiskConfig;
  private circuitBreakerUntil: number | null = null;

  constructor(config?: Partial<RiskConfig>) {
    this.config = { ...DEFAULT_RISK_CONFIG, ...config };
  }

  // ========================================================================
  // Main Evaluation
  // ========================================================================

  async evaluateOrder(
    signal: Signal,
    account: AggregatedAccount
  ): Promise<RiskEvaluation> {
    const checks: RiskCheck[] = [];

    // 1. Check circuit breaker
    const circuitBreakerStatus = this.getCircuitBreakerStatus();
    if (circuitBreakerStatus.triggered) {
      checks.push({
        name: 'circuit_breaker',
        passed: false,
        reason: `Circuit breaker triggered: ${circuitBreakerStatus.reason}`,
        severity: 'error',
      });

      return {
        decision: 'BLOCK',
        reason: 'Circuit breaker is active',
        warnings: [],
        checks,
      };
    }
    checks.push({ name: 'circuit_breaker', passed: true, reason: 'No active circuit breaker', severity: 'info' });

    // 2. Check position limit
    const positionCount = account.positions.length;
    if (positionCount >= this.config.maxConcurrentPositions) {
      checks.push({
        name: 'position_limit',
        passed: false,
        reason: `Max concurrent positions reached: ${positionCount}/${this.config.maxConcurrentPositions}`,
        severity: 'error',
      });

      return {
        decision: 'BLOCK',
        reason: 'Maximum concurrent positions reached',
        warnings: [],
        checks,
      };
    }
    checks.push({
      name: 'position_limit',
      passed: true,
      reason: `Position count: ${positionCount}/${this.config.maxConcurrentPositions}`,
      severity: 'info',
    });

    // 3. Calculate position size
    const positionSize = this.calculatePositionSize(signal, account);
    const notionalValue = positionSize.quantity * signal.entryPrice;

    // 4. Check max position size
    if (notionalValue > this.config.maxPositionPercent / 100 * account.totalEquity) {
      checks.push({
        name: 'position_size',
        passed: false,
        reason: `Position too large: ${notionalValue.toFixed(2)}`,
        severity: 'error',
      });

      return {
        decision: 'REDUCE',
        positionSize: { ...positionSize, quantity: positionSize.quantity * 0.5, method: 'reduced' as const, reasoning: 'Position size reduced due to limit' },
        reason: 'Position size exceeds maximum allowed',
        warnings: ['Position size reduced to fit within limits'],
        checks,
      };
    }
    checks.push({
      name: 'position_size',
      passed: true,
      reason: `Position size: ${positionSize.quantity} @ ${signal.entryPrice}`,
      severity: 'info',
    });

    // 5. Check exposure limits
    const exposureCheck = this.checkExposure(signal, account, positionSize.quantity);
    if (!exposureCheck.withinLimits) {
      checks.push({
        name: 'exposure',
        passed: false,
        reason: `Exposure limit violated: ${exposureCheck.violations.join(', ')}`,
        severity: 'error',
      });

      return {
        decision: 'BLOCK',
        reason: 'Exposure limits would be exceeded',
        warnings: exposureCheck.warnings,
        checks,
      };
    }
    checks.push({
      name: 'exposure',
      passed: true,
      reason: 'Exposure within limits',
      severity: 'info',
    });

    // 6. All checks passed
    return {
      decision: 'ALLOW',
      positionSize,
      reason: 'All risk checks passed',
      warnings: exposureCheck.warnings,
      checks,
    };
  }

  // ========================================================================
  // Position Sizing
  // ========================================================================

  private calculatePositionSize(signal: Signal, account: AggregatedAccount): PositionSize {
    const equity = account.totalEquity;

    // Guard against division by zero
    if (equity <= 0) {
      log.error('Invalid equity value for position sizing', undefined, { equity, source: 'account data' });
      return {
        quantity: 0,
        notionalValue: 0,
        riskAmount: 0,
        method: 'volatility',
        reasoning: 'No equity available',
      };
    }

    const riskAmount = equity * (this.config.maxRiskPerTradePercent / 100);

    // Calculate stop distance
    const stopDistance = signal.entryPrice - signal.stopLoss;
    const stopDistancePercent = Math.abs(stopDistance / signal.entryPrice);

    // Volatility-adjusted sizing
    let quantity = riskAmount / Math.abs(stopDistance);

    // Apply signal strength adjustment
    quantity = quantity * (0.5 + signal.strength * 0.5); // 50% to 100% based on strength

    // Ensure minimum order size
    const minQuantity = this.config.minOrderValue / signal.entryPrice;
    quantity = Math.max(quantity, minQuantity);

    // Ensure maximum order size
    const maxQuantity = this.config.maxOrderValue / signal.entryPrice;
    quantity = Math.min(quantity, maxQuantity);

    // Round to valid quantity
    quantity = roundTo(quantity, 2);

    const notionalValue = quantity * signal.entryPrice;

    return {
      quantity,
      notionalValue,
      riskAmount,
      method: 'volatility',
      reasoning: `Risk: ${riskAmount.toFixed(2)}, Stop: ${stopDistancePercent.toFixed(2)}%`,
    };
  }

  // ========================================================================
  // Exposure Checking
  // ========================================================================

  private checkExposure(
    signal: Signal,
    account: AggregatedAccount,
    newQuantity: number
  ): ExposureCheck {
    const violations: string[] = [];
    const warnings: string[] = [];

    // Guard against invalid equity
    if (account.totalEquity <= 0) {
      violations.push('Cannot check exposure: invalid equity value');
      return {
        withinLimits: false,
        currentExposure: {
          ...account.exposure,
          byGroup: {},
          longShort: { long: 0, short: 0, net: 0 },
        },
        violations,
        warnings,
      };
    }

    // Get current exposure
    const futuresExposure = account.exposure.futures;
    const equitiesExposure = account.exposure.equities;

    // Calculate new position value
    const newPositionValue = newQuantity * signal.entryPrice;
    const newTotalExposure = account.exposure.total + newPositionValue;

    // Check total exposure
    if (newTotalExposure > this.config.maxTotalExposurePercent / 100 * account.totalEquity) {
      violations.push(`Total exposure ${(newTotalExposure / account.totalEquity * 100).toFixed(1)}% exceeds ${this.config.maxTotalExposurePercent}%`);
    }

    // Check asset class exposure
    if (signal.assetClass === 'FUTURES') {
      const newFuturesExposure = futuresExposure + newPositionValue;
      if (newFuturesExposure > this.config.maxFuturesExposurePercent / 100 * account.totalEquity) {
        violations.push(`Futures exposure ${(newFuturesExposure / account.totalEquity * 100).toFixed(1)}% would exceed ${this.config.maxFuturesExposurePercent}%`);
      }
    } else {
      const newEquitiesExposure = equitiesExposure + newPositionValue;
      if (newEquitiesExposure > this.config.maxEquitiesExposurePercent / 100 * account.totalEquity) {
        violations.push(`Equities exposure ${(newEquitiesExposure / account.totalEquity * 100).toFixed(1)}% would exceed ${this.config.maxEquitiesExposurePercent}%`);
      }
    }

    // Check correlation group
    const group = this.getCorrelationGroup(signal.symbol);
    if (group) {
      const groupExposure = this.calculateGroupExposure(group, account.positions);
      const newGroupExposure = groupExposure + newPositionValue;

      if (newGroupExposure > group.maxConcentration * account.totalEquity) {
        violations.push(`${group.name} exposure would exceed ${group.maxConcentration * 100}% limit`);
      } else if (newGroupExposure > group.maxConcentration * account.totalEquity * 0.8) {
        warnings.push(`${group.name} exposure approaching limit`);
      }
    }

    return {
      withinLimits: violations.length === 0,
      currentExposure: {
        ...account.exposure,
        byGroup: {},
        longShort: { long: 0, short: 0, net: 0 },
      },
      violations,
      warnings,
    };
  }

  private getCorrelationGroup(symbol: string) {
    return Object.values(this.config.correlationGroups).find(g => g.symbols.includes(symbol));
  }

  private calculateGroupExposure(group: { symbols: string[] }, positions: UnifiedPosition[]): number {
    return positions
      .filter(p => group.symbols.includes(p.symbol))
      .reduce((sum, p) => sum + p.marketValue, 0);
  }

  // ========================================================================
  // Circuit Breaker
  // ========================================================================

  getCircuitBreakerStatus(): CircuitBreakerStatus {
    const now = Date.now();
    const triggered = this.circuitBreakerUntil !== null && this.circuitBreakerUntil > now;

    return {
      triggered,
      type: triggered ? 'DAILY_LOSS' : undefined,
      reason: triggered ? 'Circuit breaker active' : null,
      until: this.circuitBreakerUntil,
      warningLevel: triggered ? 'DANGER' : 'OK',
      canReset: !triggered || (this.circuitBreakerUntil !== null && this.circuitBreakerUntil <= now),
    };
  }

  triggerCircuitBreaker(reason: string, durationMinutes: number = 60): void {
    this.circuitBreakerUntil = Date.now() + durationMinutes * 60 * 1000;
    log.warn('Circuit breaker triggered', { reason, durationMinutes });
  }

  resetCircuitBreaker(): void {
    this.circuitBreakerUntil = null;
    log.info('Circuit breaker reset');
  }

  // ========================================================================
  // Configuration
  // ========================================================================

  updateConfig(updates: Partial<RiskConfig>): void {
    this.config = { ...this.config, ...updates };
    log.info('Risk config updated', { updates });
  }

  getConfig(): RiskConfig {
    return { ...this.config };
  }
}
