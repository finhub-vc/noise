/**
 * Trades Page
 * Complete trade history with filtering
 */

import { useState } from 'react';
import { useTrades } from '../hooks';

export default function TradesPage() {
  const [symbolFilter, setSymbolFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  const { data: trades, loading, error, refetch } = useTrades({
    symbol: symbolFilter || undefined,
    status: statusFilter || undefined,
  });

  const filteredTrades = trades.filter((trade) => {
    if (symbolFilter && !trade.symbol.toLowerCase().includes(symbolFilter.toLowerCase())) {
      return false;
    }
    if (statusFilter && trade.status !== statusFilter) {
      return false;
    }
    return true;
  });

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'FILLED':
        return 'bg-green-500/20 text-green-400';
      case 'PENDING':
        return 'bg-yellow-500/20 text-yellow-400';
      case 'CANCELLED':
        return 'bg-gray-500/20 text-gray-400';
      case 'REJECTED':
        return 'bg-red-500/20 text-red-400';
      default:
        return 'bg-gray-500/20 text-gray-400';
    }
  };

  const getSideColor = (side: string) => {
    return side === 'BUY' ? 'text-green-400' : 'text-red-400';
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold text-white">Trade History</h2>
        <button
          onClick={() => refetch()}
          className="px-3 py-1 bg-gray-700 hover:bg-gray-600 rounded text-sm text-gray-200"
        >
          Refresh
        </button>
      </div>

      {/* Filters */}
      <div className="flex gap-4">
        <input
          type="text"
          placeholder="Filter by symbol..."
          value={symbolFilter}
          onChange={(e) => setSymbolFilter(e.target.value)}
          className="px-3 py-2 bg-gray-800 border border-gray-700 rounded text-gray-200 text-sm focus:outline-none focus:border-green-500"
        />
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="px-3 py-2 bg-gray-800 border border-gray-700 rounded text-gray-200 text-sm focus:outline-none focus:border-green-500"
        >
          <option value="">All Statuses</option>
          <option value="PENDING">Pending</option>
          <option value="FILLED">Filled</option>
          <option value="PARTIALLY_FILLED">Partially Filled</option>
          <option value="CANCELLED">Cancelled</option>
          <option value="REJECTED">Rejected</option>
        </select>
      </div>

      {/* Trades Table */}
      <div className="bg-gray-800 rounded-lg overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-gray-400">Loading trades...</div>
        ) : error ? (
          <div className="p-8 text-center text-red-400">Error loading trades: {(error as Error).message}</div>
        ) : filteredTrades.length === 0 ? (
          <div className="p-8 text-center text-gray-400">No trades found</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-900">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase">Symbol</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase">Side</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase">Quantity</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase">Type</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase">Fill Price</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase">Status</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase">Time</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-700">
                {filteredTrades.map((trade) => (
                  <tr key={trade.id} className="hover:bg-gray-750">
                    <td className="px-4 py-3 text-sm font-medium text-white">{trade.symbol}</td>
                    <td className={`px-4 py-3 text-sm font-medium ${getSideColor(trade.side)}`}>
                      {trade.side}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-300">{trade.quantity}</td>
                    <td className="px-4 py-3 text-sm text-gray-300">{trade.order_type}</td>
                    <td className="px-4 py-3 text-sm text-gray-300">
                      {trade.avg_fill_price ? trade.avg_fill_price.toFixed(2) : '-'}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-1 rounded text-xs font-medium ${getStatusColor(trade.status)}`}>
                        {trade.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-400">
                      {new Date(trade.created_at).toLocaleString()}
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
