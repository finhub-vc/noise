/**
 * Performance Page
 * Detailed performance metrics and charts
 */

import { usePerformance, useEquityCurve } from '../hooks';
import {
  LineChart,
  Line,
  AreaChart,
  Area,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';

export default function PerformancePage() {
  const { data: performance, loading: perfLoading } = usePerformance({ period: 'all' });
  const { data: equityCurve, loading: equityLoading } = useEquityCurve({ limit: 100 });

  if (perfLoading || equityLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-400">Loading performance data...</div>
      </div>
    );
  }

  if (!performance) {
    return <div className="text-gray-400">No performance data available</div>;
  }

  // Prepare equity curve data
  const equityChartData = equityCurve.map((point) => ({
    time: new Date(point.timestamp).toLocaleDateString(),
    equity: point.equity,
  }));

  // Win/Loss distribution
  const winLossData = [
    { name: 'Winning', value: performance.summary.winningTrades, color: '#22c55e' },
    { name: 'Losing', value: performance.summary.losingTrades, color: '#ef4444' },
  ];

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-semibold text-white">Performance</h2>

      {/* Summary Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-gray-800 rounded-lg p-4">
          <div className="text-sm text-gray-400 mb-1">Total Trades</div>
          <div className="text-2xl font-bold text-white">{performance.summary.totalTrades}</div>
        </div>
        <div className="bg-gray-800 rounded-lg p-4">
          <div className="text-sm text-gray-400 mb-1">Win Rate</div>
          <div className={`text-2xl font-bold ${performance.summary.winRate >= 50 ? 'text-green-400' : 'text-red-400'}`}>
            {performance.summary.winRate.toFixed(1)}%
          </div>
        </div>
        <div className="bg-gray-800 rounded-lg p-4">
          <div className="text-sm text-gray-400 mb-1">Total P&L</div>
          <div className={`text-2xl font-bold ${performance.summary.totalPnl >= 0 ? 'text-green-400' : 'text-red-400'}`}>
            ${performance.summary.totalPnl.toFixed(2)}
          </div>
        </div>
        <div className="bg-gray-800 rounded-lg p-4">
          <div className="text-sm text-gray-400 mb-1">Sharpe Ratio</div>
          <div className="text-2xl font-bold text-white">{performance.summary.sharpeRatio.toFixed(2)}</div>
        </div>
      </div>

      {/* Additional Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-gray-800 rounded-lg p-4">
          <div className="text-sm text-gray-400 mb-1">Profit Factor</div>
          <div className="text-xl font-bold text-white">
            {typeof performance.summary.profitFactor === 'number'
              ? performance.summary.profitFactor.toFixed(2)
              : performance.summary.profitFactor}
          </div>
        </div>
        <div className="bg-gray-800 rounded-lg p-4">
          <div className="text-sm text-gray-400 mb-1">Gross Profit</div>
          <div className="text-xl font-bold text-green-400">
            ${performance.summary.grossProfit.toFixed(2)}
          </div>
        </div>
        <div className="bg-gray-800 rounded-lg p-4">
          <div className="text-sm text-gray-400 mb-1">Gross Loss</div>
          <div className="text-xl font-bold text-red-400">
            ${performance.summary.grossLoss.toFixed(2)}
          </div>
        </div>
      </div>

      {/* Equity Curve Chart */}
      <div className="bg-gray-800 rounded-lg p-6">
        <h3 className="text-lg font-semibold text-white mb-4">Equity Curve</h3>
        <ResponsiveContainer width="100%" height={300}>
          <AreaChart data={equityChartData}>
            <defs>
              <linearGradient id="equityGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#22c55e" stopOpacity={0.3} />
                <stop offset="95%" stopColor="#22c55e" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
            <XAxis dataKey="time" stroke="#9ca3af" />
            <YAxis stroke="#9ca3af" />
            <Tooltip
              contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: '8px' }}
              labelStyle={{ color: '#f3f4f6' }}
            />
            <Area
              type="monotone"
              dataKey="equity"
              stroke="#22c55e"
              fillOpacity={1}
              fill="url(#equityGradient)"
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* Win/Loss Pie Chart */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-gray-800 rounded-lg p-6">
          <h3 className="text-lg font-semibold text-white mb-4">Win/Loss Distribution</h3>
          <ResponsiveContainer width="100%" height={250}>
            <PieChart>
              <Pie
                data={winLossData}
                cx="50%"
                cy="50%"
                innerRadius={60}
                outerRadius={80}
                paddingAngle={5}
                dataKey="value"
              >
                {winLossData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip
                contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: '8px' }}
                labelStyle={{ color: '#f3f4f6' }}
              />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        </div>

        <div className="bg-gray-800 rounded-lg p-6">
          <h3 className="text-lg font-semibold text-white mb-4">Trade Statistics</h3>
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <span className="text-gray-400">Winning Trades</span>
              <span className="text-green-400 font-semibold">{performance.summary.winningTrades}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-gray-400">Losing Trades</span>
              <span className="text-red-400 font-semibold">{performance.summary.losingTrades}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-gray-400">Win Rate</span>
              <span className="text-white font-semibold">{performance.summary.winRate.toFixed(1)}%</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-gray-400">Profit Factor</span>
              <span className="text-white font-semibold">
                {typeof performance.summary.profitFactor === 'number'
                  ? performance.summary.profitFactor.toFixed(2)
                  : performance.summary.profitFactor}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
