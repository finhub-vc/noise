/**
 * usePerformance Hook
 * Fetches performance metrics and equity curve data
 */

import { useState, useEffect, useCallback } from 'react';

export interface PerformanceSummary {
  totalTrades: number;
  winningTrades: number;
  losingTrades: number;
  winRate: number;
  totalPnl: number;
  grossProfit: number;
  grossLoss: number;
  profitFactor: number | string;
  sharpeRatio: number;
}

export interface EquityPoint {
  id: number;
  timestamp: number;
  equity: number;
  cash: number;
  margin_used: number;
}

export interface PerformanceData {
  period: string;
  summary: PerformanceSummary;
  equityCurve: EquityPoint[];
  timestamp: number;
}

interface UsePerformanceOptions {
  refreshInterval?: number;
  enabled?: boolean;
  period?: 'day' | 'week' | 'month' | 'year' | 'all';
}

export function usePerformance(options: UsePerformanceOptions = {}) {
  const {
    refreshInterval = 60000, // Refresh every minute
    enabled = true,
    period = 'all',
  } = options;

  const [data, setData] = useState<PerformanceData | null>(null);
  const [equityCurve, setEquityCurve] = useState<EquityPoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchPerformance = useCallback(async () => {
    if (!enabled) return;

    setLoading(true);
    setError(null);

    try {
      // Fetch performance summary
      const perfUrl = new URL('/api/performance', window.location.origin);
      perfUrl.searchParams.set('period', period);

      const perfResponse = await fetch(perfUrl.toString());
      if (!perfResponse.ok) {
        throw new Error(`HTTP ${perfResponse.status}: ${perfResponse.statusText}`);
      }

      const perfData: PerformanceData = await perfResponse.json();
      setData(perfData);

      // Fetch equity curve separately for full history
      // Note: Equity curve is optional - dashboard remains functional without it
      const equityResponse = await fetch('/api/performance/equity-curve?limit=1000');
      if (equityResponse.ok) {
        const equityData = await equityResponse.json();
        setEquityCurve(equityData.equityCurve);
      } else {
        // Log non-200 responses for debugging but don't fail the request
        console.warn(`Equity curve fetch failed: HTTP ${equityResponse.status}`);
      }
    } catch (err) {
      setError(err as Error);
    } finally {
      setLoading(false);
    }
  }, [enabled, period]);

  useEffect(() => {
    fetchPerformance();

    if (refreshInterval > 0) {
      const interval = setInterval(fetchPerformance, refreshInterval);
      return () => clearInterval(interval);
    }
  }, [fetchPerformance, refreshInterval]);

  return {
    data,
    equityCurve,
    loading,
    error,
    refetch: fetchPerformance,
  };
}

/**
 * Hook for just equity curve data
 */
interface UseEquityCurveOptions {
  refreshInterval?: number;
  enabled?: boolean;
  limit?: number;
}

export function useEquityCurve(options: UseEquityCurveOptions = {}) {
  const { refreshInterval = 0, enabled = true, limit = 1000 } = options;

  const [data, setData] = useState<EquityPoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchEquityCurve = useCallback(async () => {
    if (!enabled) return;

    setLoading(true);
    setError(null);

    try {
      const url = new URL('/api/performance/equity-curve', window.location.origin);
      url.searchParams.set('limit', limit.toString());

      const response = await fetch(url.toString());
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const result = await response.json();
      setData(result.equityCurve);
    } catch (err) {
      setError(err as Error);
    } finally {
      setLoading(false);
    }
  }, [enabled, limit]);

  useEffect(() => {
    fetchEquityCurve();

    if (refreshInterval > 0) {
      const interval = setInterval(fetchEquityCurve, refreshInterval);
      return () => clearInterval(interval);
    }
  }, [fetchEquityCurve, refreshInterval]);

  return { data, loading, error, refetch: fetchEquityCurve };
}
