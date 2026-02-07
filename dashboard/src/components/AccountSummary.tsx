/**
 * Account Summary Component
 * Displays total equity, cash, buying power, and daily P&L
 */

import React from 'react';
import { useAccount } from '../hooks/useAccount';

interface PnLDisplayProps {
  pnl: number;
  pnlPercent: number;
}

function PnLDisplay({ pnl, pnlPercent }: PnLDisplayProps) {
  const isPositive = pnl >= 0;
  const colorClass = isPositive ? 'text-green-400' : 'text-red-400';
  const arrow = isPositive ? '▲' : '▼';

  return (
    <div className={`text-xl font-bold ${colorClass} flex items-center gap-1`}>
      <span className="text-base" aria-hidden="true">{arrow}</span>
      {isPositive ? '+' : ''}{pnl.toFixed(2)}
      <span className="text-sm ml-1">({pnlPercent.toFixed(2)}%)</span>
    </div>
  );
}

interface AccountMetricProps {
  label: string;
  value: string | React.ReactNode;
  className?: string;
}

function AccountMetric({ label, value, className = '' }: AccountMetricProps) {
  return (
    <div>
      <div className="text-gray-400 text-sm">{label}</div>
      <div className={`text-xl ${className}`}>{value}</div>
    </div>
  );
}

export default function AccountSummary() {
  const { data, loading, error, refetch } = useAccount({ refreshInterval: 30000 });

  if (loading && !data) {
    return (
      <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
        <h2 className="text-lg font-semibold mb-4">Account Summary</h2>
        <div className="flex items-center gap-2 text-gray-500">
          <div className="animate-spin h-4 w-4 border-2 border-gray-500 border-t-transparent rounded-full" />
          <span>Loading account data...</span>
        </div>
      </div>
    );
  }

  if (error && !data) {
    return (
      <div className="bg-gray-800 rounded-lg p-6 border border-red-700">
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-lg font-semibold">Account Summary</h2>
          <span className="text-red-400 text-sm" aria-label="Error">⚠️</span>
        </div>
        <div className="text-red-400 mb-3">Failed to load account data</div>
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

  return (
    <div className="bg-gray-800 rounded-lg p-6 border border-gray-700 relative">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold">Account Summary</h2>
        {error && (
          <span
            className="text-yellow-400 text-xs cursor-help"
            title={`Error updating: ${error.message}`}
            aria-label="Data may be stale"
          >
            ⚠️ Stale
          </span>
        )}
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <AccountMetric
          label="Total Equity"
          value={`$${data.equity.toLocaleString()}`}
          className="text-2xl font-bold"
        />
        <AccountMetric
          label="Cash"
          value={`$${data.cash.toLocaleString()}`}
        />
        <AccountMetric
          label="Buying Power"
          value={`$${data.buyingPower.toLocaleString()}`}
        />
        <div>
          <div className="text-gray-400 text-sm">Daily P&L</div>
          <PnLDisplay pnl={data.dailyPnl} pnlPercent={data.dailyPnlPercent} />
        </div>
      </div>
    </div>
  );
}
