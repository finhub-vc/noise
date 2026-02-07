/**
 * Signals Page
 * Signal history and strategy performance
 */

import { useState } from 'react';
import { useSignals } from '../hooks';

export default function SignalsPage() {
  const [strategyFilter, setStrategyFilter] = useState('');

  const { data: signals, loading, error, refetch } = useSignals({
    activeOnly: false,
    strategy: strategyFilter || undefined,
  });

  const filteredSignals = signals.filter((signal) => {
    if (strategyFilter && signal.strategy !== strategyFilter) {
      return false;
    }
    return true;
  });

  const getDirectionColor = (direction: string) => {
    return direction === 'LONG' ? 'text-green-400' : 'text-red-400';
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'ACTIVE':
        return 'bg-blue-500/20 text-blue-400';
      case 'EXECUTED':
        return 'bg-green-500/20 text-green-400';
      case 'EXPIRED':
        return 'bg-yellow-500/20 text-yellow-400';
      case 'CANCELLED':
        return 'bg-gray-500/20 text-gray-400';
      default:
        return 'bg-gray-500/20 text-gray-400';
    }
  };

  // Calculate strategy stats
  const strategyStats = signals.reduce((acc, signal) => {
    if (!acc[signal.strategy]) {
      acc[signal.strategy] = { count: 0, executed: 0, totalStrength: 0 };
    }
    acc[signal.strategy].count++;
    if (signal.status === 'EXECUTED') {
      acc[signal.strategy].executed++;
    }
    acc[signal.strategy].totalStrength += signal.strength;
    return acc;
  }, {} as Record<string, { count: number; executed: number; totalStrength: number }>);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold text-white">Signal History</h2>
        <button
          onClick={() => refetch()}
          className="px-3 py-1 bg-gray-700 hover:bg-gray-600 rounded text-sm text-gray-200"
        >
          Refresh
        </button>
      </div>

      {/* Strategy Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {Object.entries(strategyStats).map(([strategy, stats]) => (
          <div key={strategy} className="bg-gray-800 rounded-lg p-4">
            <div className="text-sm text-gray-400 mb-1">{strategy}</div>
            <div className="text-2xl font-bold text-white">{stats.count}</div>
            <div className="text-xs text-gray-500 mt-1">
              {stats.executed} executed • avg strength: {(stats.totalStrength / stats.count).toFixed(2)}
            </div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex gap-4">
        <select
          value={strategyFilter}
          onChange={(e) => setStrategyFilter(e.target.value)}
          className="px-3 py-2 bg-gray-800 border border-gray-700 rounded text-gray-200 text-sm focus:outline-none focus:border-green-500"
        >
          <option value="">All Strategies</option>
          <option value="momentum">Momentum</option>
          <option value="meanReversion">Mean Reversion</option>
          <option value="breakout">Breakout</option>
          <option value="manual">Manual</option>
        </select>
      </div>

      {/* Signals Table */}
      <div className="bg-gray-800 rounded-lg overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-gray-400">Loading signals...</div>
        ) : error ? (
          <div className="p-8 text-center text-red-400">Error loading signals: {(error as Error).message}</div>
        ) : filteredSignals.length === 0 ? (
          <div className="p-8 text-center text-gray-400">No signals found</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-900">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase">Symbol</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase">Direction</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase">Strength</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase">Strategy</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase">Entry</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase">Stop</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase">Status</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase">Time</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-700">
                {filteredSignals.map((signal) => (
                  <tr key={signal.id} className="hover:bg-gray-750">
                    <td className="px-4 py-3 text-sm font-medium text-white">{signal.symbol}</td>
                    <td className={`px-4 py-3 text-sm font-medium ${getDirectionColor(signal.direction)}`}>
                      {signal.direction}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-300">
                      <div className="flex items-center gap-2">
                        <div className="w-16 bg-gray-700 rounded-full h-2">
                          <div
                            className="bg-green-500 h-2 rounded-full"
                            style={{ width: `${signal.strength * 100}%` }}
                          />
                        </div>
                        <span>{(signal.strength * 100).toFixed(0)}%</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-300 capitalize">{signal.strategy}</td>
                    <td className="px-4 py-3 text-sm text-gray-300">{signal.entry_price.toFixed(2)}</td>
                    <td className="px-4 py-3 text-sm text-gray-300">{signal.stop_loss.toFixed(2)}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-1 rounded text-xs font-medium ${getStatusColor(signal.status)}`}>
                        {signal.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-400">
                      {new Date(signal.timestamp).toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
