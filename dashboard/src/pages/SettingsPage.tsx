/**
 * Settings Page
 * Configuration and controls
 */

import { useState } from 'react';

export default function SettingsPage() {
  const [resetting, setResetting] = useState(false);
  const [message, setMessage] = useState('');

  const handleResetCircuitBreaker = async () => {
    setResetting(true);
    setMessage('');

    try {
      const response = await fetch('/api/risk/reset-circuit-breaker', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (response.ok) {
        setMessage('Circuit breaker reset successfully!');
      } else {
        setMessage('Failed to reset circuit breaker');
      }
    } catch (error) {
      setMessage('Error resetting circuit breaker');
    } finally {
      setResetting(false);
    }
  };

  // Risk configuration (read-only display)
  const riskConfig = {
    maxRiskPerTradePercent: 2,
    maxDailyLossPercent: 5,
    maxWeeklyLossPercent: 10,
    maxDrawdownPercent: 15,
    maxPositionPercent: 20,
    maxConcurrentPositions: 10,
    maxCorrelatedConcentration: 40,
    maxTotalExposurePercent: 200,
  };

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-semibold text-white">Settings</h2>

      {/* Risk Configuration */}
      <div className="bg-gray-800 rounded-lg p-6">
        <h3 className="text-lg font-semibold text-white mb-4">Risk Configuration</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="flex justify-between items-center py-2 border-b border-gray-700">
            <span className="text-gray-400">Max Risk Per Trade</span>
            <span className="text-white font-semibold">{riskConfig.maxRiskPerTradePercent}%</span>
          </div>
          <div className="flex justify-between items-center py-2 border-b border-gray-700">
            <span className="text-gray-400">Max Daily Loss</span>
            <span className="text-white font-semibold">{riskConfig.maxDailyLossPercent}%</span>
          </div>
          <div className="flex justify-between items-center py-2 border-b border-gray-700">
            <span className="text-gray-400">Max Weekly Loss</span>
            <span className="text-white font-semibold">{riskConfig.maxWeeklyLossPercent}%</span>
          </div>
          <div className="flex justify-between items-center py-2 border-b border-gray-700">
            <span className="text-gray-400">Max Drawdown</span>
            <span className="text-white font-semibold">{riskConfig.maxDrawdownPercent}%</span>
          </div>
          <div className="flex justify-between items-center py-2 border-b border-gray-700">
            <span className="text-gray-400">Max Position Size</span>
            <span className="text-white font-semibold">{riskConfig.maxPositionPercent}%</span>
          </div>
          <div className="flex justify-between items-center py-2 border-b border-gray-700">
            <span className="text-gray-400">Max Concurrent Positions</span>
            <span className="text-white font-semibold">{riskConfig.maxConcurrentPositions}</span>
          </div>
          <div className="flex justify-between items-center py-2 border-b border-gray-700">
            <span className="text-gray-400">Max Correlated Exposure</span>
            <span className="text-white font-semibold">{riskConfig.maxCorrelatedConcentration}%</span>
          </div>
          <div className="flex justify-between items-center py-2 border-b border-gray-700">
            <span className="text-gray-400">Max Total Exposure</span>
            <span className="text-white font-semibold">{riskConfig.maxTotalExposurePercent}%</span>
          </div>
        </div>
      </div>

      {/* System Controls */}
      <div className="bg-gray-800 rounded-lg p-6">
        <h3 className="text-lg font-semibold text-white mb-4">System Controls</h3>

        <div className="space-y-4">
          <div className="flex items-center justify-between py-3 border-b border-gray-700">
            <div>
              <div className="text-white font-medium">Reset Circuit Breaker</div>
              <div className="text-sm text-gray-400">
                Manually reset the circuit breaker if it was triggered
              </div>
            </div>
            <button
              onClick={handleResetCircuitBreaker}
              disabled={resetting}
              className="px-4 py-2 bg-yellow-600 hover:bg-yellow-700 disabled:bg-gray-600 disabled:cursor-not-allowed rounded text-white text-sm font-medium"
            >
              {resetting ? 'Resetting...' : 'Reset'}
            </button>
          </div>

          <div className="flex items-center justify-between py-3 border-b border-gray-700">
            <div>
              <div className="text-white font-medium">Trading Mode</div>
              <div className="text-sm text-gray-400">
                Current trading mode (configured via environment)
              </div>
            </div>
            <span className="px-3 py-1 bg-blue-500/20 text-blue-400 rounded text-sm font-medium">
              Paper Trading
            </span>
          </div>

          <div className="flex items-center justify-between py-3">
            <div>
              <div className="text-white font-medium">API Version</div>
              <div className="text-sm text-gray-400">Current API version</div>
            </div>
            <span className="px-3 py-1 bg-gray-700 text-gray-300 rounded text-sm font-medium">
              v1.0.0
            </span>
          </div>
        </div>

        {message && (
          <div className={`mt-4 p-3 rounded ${message.includes('success') ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}>
            {message}
          </div>
        )}
      </div>

      {/* Signal Configuration */}
      <div className="bg-gray-800 rounded-lg p-6">
        <h3 className="text-lg font-semibold text-white mb-4">Signal Configuration</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-gray-700/50 rounded p-3">
            <div className="text-sm text-gray-400">Momentum Weight</div>
            <div className="text-lg font-semibold text-white">40%</div>
          </div>
          <div className="bg-gray-700/50 rounded p-3">
            <div className="text-sm text-gray-400">Mean Reversion Weight</div>
            <div className="text-lg font-semibold text-white">30%</div>
          </div>
          <div className="bg-gray-700/50 rounded p-3">
            <div className="text-sm text-gray-400">Breakout Weight</div>
            <div className="text-lg font-semibold text-white">30%</div>
          </div>
        </div>
      </div>
    </div>
  );
}
