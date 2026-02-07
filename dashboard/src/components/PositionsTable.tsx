/**
 * Positions Table Component
 * Displays open positions with unrealized P&L
 */

import { usePositions, type Position } from '../hooks/usePositions';

interface PnLValueProps {
  value: number;
}

function PnLValue({ value }: PnLValueProps) {
  const isPositive = value >= 0;
  const colorClass = isPositive ? 'text-green-400' : 'text-red-400';

  return (
    <span className={colorClass}>
      {isPositive ? '+' : ''}${value.toFixed(2)}
    </span>
  );
}

interface SideBadgeProps {
  side: 'LONG' | 'SHORT';
}

function SideBadge({ side }: SideBadgeProps) {
  const isLong = side === 'LONG';
  const bgClass = isLong ? 'bg-blue-500/20 text-blue-400' : 'bg-orange-500/20 text-orange-400';

  return (
    <span className={`text-xs px-2 py-1 rounded ${bgClass}`}>
      {side}
    </span>
  );
}

export default function PositionsTable() {
  const { data, loading, error, refetch } = usePositions({ refreshInterval: 10000 });

  if (loading && !data.length) {
    return (
      <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
        <h2 className="text-lg font-semibold mb-4">Open Positions</h2>
        <div className="flex items-center gap-2 text-gray-500">
          <div className="animate-spin h-4 w-4 border-2 border-gray-500 border-t-transparent rounded-full" />
          <span>Loading positions...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold">Open Positions</h2>
        <div className="flex items-center gap-2">
          {data.length > 0 && (
            <span className="text-sm text-gray-400">
              {data.length} {data.length === 1 ? 'position' : 'positions'}
            </span>
          )}
          {error && (
            <button
              onClick={() => refetch()}
              className="px-2 py-1 bg-gray-700 hover:bg-gray-600 rounded text-xs transition-colors"
              aria-label="Retry loading positions"
            >
              ↻
            </button>
          )}
        </div>
      </div>

      {data.length === 0 ? (
        <div className="text-center py-8 text-gray-500">
          <p>{error ? 'Failed to load positions' : 'No open positions'}</p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-gray-400 border-b border-gray-700">
                <th className="pb-2 font-medium">Symbol</th>
                <th className="pb-2 font-medium">Side</th>
                <th className="pb-2 font-medium">Quantity</th>
                <th className="pb-2 font-medium">Entry</th>
                <th className="pb-2 font-medium">Current</th>
                <th className="pb-2 text-right font-medium">P&L</th>
              </tr>
            </thead>
            <tbody>
              {data.map((pos) => (
                <tr key={pos.id} className="border-b border-gray-700 hover:bg-gray-700/50 transition-colors">
                  <td className="py-3 font-medium">{pos.symbol}</td>
                  <td className="py-3">
                    <SideBadge side={pos.side} />
                  </td>
                  <td className="py-3">{pos.quantity}</td>
                  <td className="py-3">
                    ${(pos.entry_price || pos.entryPrice || 0).toFixed(2)}
                  </td>
                  <td className="py-3">
                    ${(pos.current_price || pos.currentPrice || 0).toFixed(2)}
                  </td>
                  <td className="py-3 text-right font-medium">
                    <PnLValue value={pos.unrealized_pnl || pos.unrealizedPnl || 0} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
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
