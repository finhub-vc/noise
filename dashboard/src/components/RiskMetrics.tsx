/**
 * Risk Metrics Component
 * Displays risk state with circuit breaker management
 */

import React, { useState, useCallback } from 'react';
import { useRisk, type RiskState } from '../hooks/useRisk';

interface MetricRowProps {
  label: string;
  value: React.ReactNode;
  valueClass?: string;
}

function MetricRow({ label, value, valueClass = 'text-white' }: MetricRowProps) {
  return (
    <div className="flex justify-between">
      <span className="text-gray-400">{label}</span>
      <span className={valueClass}>{value}</span>
    </div>
  );
}

interface PnLValueProps {
  value: number;
  showPercent?: boolean;
  percent?: number;
}

function PnLValue({ value, showPercent = false, percent }: PnLValueProps) {
  const isPositive = value >= 0;
  const colorClass = isPositive ? 'text-green-400' : 'text-red-400';
  const arrow = isPositive ? '▲' : '▼';

  return (
    <span className={colorClass}>
      <span aria-hidden="true">{arrow} </span>
      {isPositive ? '+' : ''}${value.toFixed(2)}
      {showPercent && percent !== undefined && (
        <span className="ml-1">({percent.toFixed(2)}%)</span>
      )}
    </span>
  );
}

interface CircuitBreakerButtonProps {
  resetting: boolean;
  onReset: () => void;
}

function CircuitBreakerButton({ resetting, onReset }: CircuitBreakerButtonProps) {
  const [showConfirm, setShowConfirm] = useState(false);

  const handleReset = useCallback(() => {
    if (showConfirm) {
      onReset();
      setShowConfirm(false);
    } else {
      setShowConfirm(true);
    }
  }, [showConfirm, onReset]);

  const handleCancel = useCallback(() => {
    setShowConfirm(false);
  }, []);

  if (showConfirm) {
    return (
      <div className="mt-3 p-3 bg-red-900/30 border border-red-700 rounded">
        <p className="text-sm text-red-300 mb-2">
          Are you sure? This will re-enable trading.
        </p>
        <div className="flex gap-2">
          <button
            onClick={handleReset}
            disabled={resetting}
            className="flex-1 bg-red-600 hover:bg-red-700 disabled:bg-red-800 text-white py-2 rounded text-sm transition-colors"
          >
            {resetting ? 'Resetting...' : 'Confirm Reset'}
          </button>
          <button
            onClick={handleCancel}
            disabled={resetting}
            className="px-3 bg-gray-700 hover:bg-gray-600 text-white py-2 rounded text-sm transition-colors"
          >
            Cancel
          </button>
        </div>
      </div>
    );
  }

  return (
    <button
      onClick={() => setShowConfirm(true)}
      className="w-full mt-2 bg-red-600 hover:bg-red-700 text-white py-2 rounded text-sm transition-colors"
    >
      Reset Circuit Breaker
    </button>
  );
}

export default function RiskMetrics() {
  const { data, loading, error, resetting, refetch, resetCircuitBreaker } = useRisk({ refreshInterval: 30000 });

  const handleReset = useCallback(async () => {
    const success = await resetCircuitBreaker();
    if (!success) {
      // Error is handled by the hook
      console.error('Failed to reset circuit breaker');
    }
  }, [resetCircuitBreaker]);

  if (loading && !data) {
    return (
      <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
        <h2 className="text-lg font-semibold mb-4">Risk Metrics</h2>
        <div className="flex items-center gap-2 text-gray-500">
          <div className="animate-spin h-4 w-4 border-2 border-gray-500 border-t-transparent rounded-full" />
          <span>Loading risk metrics...</span>
        </div>
      </div>
    );
  }

  if (error && !data) {
    return (
      <div className="bg-gray-800 rounded-lg p-6 border border-red-700">
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-lg font-semibold">Risk Metrics</h2>
          <span className="text-red-400 text-sm" aria-label="Error">⚠️</span>
        </div>
        <div className="text-red-400 mb-3">Failed to load risk data</div>
        <button
          onClick={() => refetch()}
          className="px-3 py-1 bg-gray-700 hover:bg-gray-600 rounded text-sm transition-colors"
        >
          Retry
        </button>
      </div>
    );
  }

  if (!data) {
    return null;
  }

  const hasHighConsecutiveLosses = (data.consecutiveLosses || 0) > 2;
  const isCircuitBreakerActive = data.circuitBreakerTriggered;

  return (
    <div className="bg-gray-800 rounded-lg p-6 border border-gray-700 relative">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold">Risk Metrics</h2>
        {error && (
          <span
            className="text-yellow-400 text-xs cursor-help"
            title={`Error updating: ${error.message}`}
            aria-label="Data may be stale"
          >
            ⚠️
          </span>
        )}
      </div>

      <div className="space-y-3">
        <MetricRow
          label="Daily P&L"
          value={<PnLValue value={data.dailyPnl || 0} showPercent percent={data.dailyPnlPercent} />}
        />
        <MetricRow
          label="Consecutive Losses"
          value={data.consecutiveLosses || 0}
          valueClass={hasHighConsecutiveLosses ? 'text-red-400' : 'text-white'}
        />
        <MetricRow
          label="Circuit Breaker"
          value={
            <span className={isCircuitBreakerActive ? 'text-red-400 font-medium' : 'text-green-400'}>
              {isCircuitBreakerActive ? '⚠️ TRIGGERED' : '○ OFF'}
            </span>
          }
        />

        {isCircuitBreakerActive && data.circuitBreakerReason && (
          <div className="text-xs text-red-400 mt-1">
            Reason: {data.circuitBreakerReason}
          </div>
        )}

        {isCircuitBreakerActive && (
          <CircuitBreakerButton
            resetting={resetting}
            onReset={handleReset}
          />
        )}
      </div>

      {error && !isCircuitBreakerActive && (
        <div className="mt-3 text-xs text-yellow-400" role="alert">
          ⚠️ Last update failed. Data may be stale.
        </div>
      )}
    </div>
  );
}
