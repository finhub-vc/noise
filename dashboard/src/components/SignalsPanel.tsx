/**
 * Signals Panel Component
 * Displays active trading signals
 */

import React from 'react';
import { useSignals, type Signal } from '../hooks/useSignals';

interface SignalCardProps {
  signal: Signal;
}

function SignalCard({ signal }: SignalCardProps) {
  const isLong = signal.direction === 'LONG';
  const directionColor = isLong
    ? 'bg-green-500/20 text-green-400 border-green-500/30'
    : 'bg-red-500/20 text-red-400 border-red-500/30';
  const strengthPercent = Math.round((signal.strength || 0) * 100);
  const entryPrice = signal.entry_price || signal.entryPrice || 0;
  const stopLoss = signal.stop_loss || signal.stopLoss || 0;
  const takeProfit = signal.take_profit || signal.takeProfit;

  return (
    <div className={`bg-gray-700/50 rounded p-3 border ${directionColor}`}>
      <div className="flex justify-between items-center mb-2">
        <span className="font-medium">{signal.symbol}</span>
        <span className={`text-xs px-2 py-1 rounded ${directionColor}`}>
          {signal.direction}
        </span>
      </div>
      <div className="text-xs text-gray-400 space-y-1">
        <div className="flex justify-between">
          <span>Entry:</span>
          <span className="text-gray-300">${entryPrice.toFixed(2)}</span>
        </div>
        <div className="flex justify-between">
          <span>Stop:</span>
          <span className="text-red-400">${stopLoss.toFixed(2)}</span>
        </div>
        {takeProfit && (
          <div className="flex justify-between">
            <span>Target:</span>
            <span className="text-green-400">${takeProfit.toFixed(2)}</span>
          </div>
        )}
        <div className="flex justify-between">
          <span>Strength:</span>
          <span className="text-gray-300">{strengthPercent}%</span>
        </div>
        {signal.strategy && (
          <div className="flex justify-between">
            <span>Strategy:</span>
            <span className="text-gray-500">{signal.strategy}</span>
          </div>
        )}
      </div>
    </div>
  );
}

export default function SignalsPanel() {
  const { data, loading, error, refetch } = useSignals({
    refreshInterval: 30000,
    activeOnly: true,
  });

  if (loading && !data.length) {
    return (
      <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
        <h2 className="text-lg font-semibold mb-4">Active Signals</h2>
        <div className="flex items-center gap-2 text-gray-500">
          <div className="animate-spin h-4 w-4 border-2 border-gray-500 border-t-transparent rounded-full" />
          <span>Loading signals...</span>
        </div>
      </div>
    );
  }

  if (error && !data.length) {
    return (
      <div className="bg-gray-800 rounded-lg p-6 border border-red-700">
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-lg font-semibold">Active Signals</h2>
          <span className="text-red-400 text-sm" aria-label="Error">⚠️</span>
        </div>
        <div className="text-red-400 mb-3">Failed to load signals</div>
        <button
          onClick={() => refetch()}
          className="px-3 py-1 bg-gray-700 hover:bg-gray-600 rounded text-sm transition-colors"
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold">Active Signals</h2>
        <div className="flex items-center gap-2">
          {data.length > 0 && (
            <span className="text-sm text-gray-400">
              {data.length} {data.length === 1 ? 'signal' : 'signals'}
            </span>
          )}
          {error && data.length > 0 && (
            <button
              onClick={() => refetch()}
              className="px-2 py-1 bg-gray-700 hover:bg-gray-600 rounded text-xs transition-colors"
              aria-label="Retry loading signals"
            >
              ↻
            </button>
          )}
        </div>
      </div>

      {data.length === 0 ? (
        <div className="text-center py-8 text-gray-500">
          <p>No active signals</p>
        </div>
      ) : (
        <div className="space-y-3">
          {data.map((signal) => (
            <SignalCard key={signal.id} signal={signal} />
          ))}
        </div>
      )}

      {error && data.length > 0 && (
        <div className="mt-3 text-xs text-yellow-400" role="alert">
          ⚠️ Last update failed. Data may be stale.
        </div>
      )}
    </div>
  );
}
