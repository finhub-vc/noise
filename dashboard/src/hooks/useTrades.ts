/**
 * useTrades Hook
 * Fetches trade history with filtering support
 */

import { useState, useEffect, useCallback } from 'react';

export interface Trade {
  id: string;
  symbol: string;
  asset_class: string;
  broker: string;
  client_order_id: string;
  broker_order_id?: string;
  side: 'BUY' | 'SELL';
  quantity: number;
  order_type: 'MARKET' | 'LIMIT' | 'STOP' | 'STOP_LIMIT';
  limit_price?: number;
  status: 'PENDING' | 'FILLED' | 'PARTIALLY_FILLED' | 'CANCELLED' | 'REJECTED';
  filled_quantity: number;
  avg_fill_price?: number;
  signal_id?: string;
  created_at: number;
  filled_at?: number;
}

interface TradesResponse {
  trades: Trade[];
  total: number; // Total number of trades available (for pagination)
  limit: number;
  offset: number;
  timestamp: number;
}

interface UseTradesOptions {
  refreshInterval?: number;
  enabled?: boolean;
  todayOnly?: boolean;
  symbol?: string;
  status?: string;
  side?: string;
  limit?: number;
  offset?: number;
}

export function useTrades(options: UseTradesOptions = {}) {
  const {
    refreshInterval = 0, // Don't auto-refresh by default for trade history
    enabled = true,
    todayOnly = false,
    symbol,
    status,
    side,
    limit = 100,
    offset = 0,
  } = options;

  const [data, setData] = useState<Trade[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [totalCount, setTotalCount] = useState(0);

  const fetchTrades = useCallback(async () => {
    if (!enabled) return;

    setLoading(true);
    setError(null);

    try {
      const url = todayOnly
        ? '/api/trades/today'
        : '/api/trades';

      const queryParams = new URLSearchParams();
      if (!todayOnly) {
        if (symbol) queryParams.set('symbol', symbol);
        if (status) queryParams.set('status', status);
        if (side) queryParams.set('side', side);
        queryParams.set('limit', limit.toString());
        queryParams.set('offset', offset.toString());
      }

      const queryString = queryParams.toString();
      const fetchUrl = queryString ? `${url}?${queryString}` : url;

      const response = await fetch(fetchUrl);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const result: TradesResponse = await response.json();
      setData(result.trades);
      // Use the total count from the API response for proper pagination
      setTotalCount(result.total);
    } catch (err) {
      setError(err as Error);
    } finally {
      setLoading(false);
    }
  }, [enabled, todayOnly, symbol, status, side, limit, offset]);

  useEffect(() => {
    fetchTrades();

    if (refreshInterval > 0) {
      const interval = setInterval(fetchTrades, refreshInterval);
      return () => clearInterval(interval);
    }
  }, [fetchTrades, refreshInterval]);

  return { data, loading, error, totalCount, refetch: fetchTrades };
}
