/**
 * usePositions Hook
 * Fetches open positions with automatic refresh
 */

import { useState, useEffect, useCallback } from 'react';

export interface Position {
  id: string;
  symbol: string;
  asset_class: string;
  broker: string;
  side: 'LONG' | 'SHORT';
  quantity: number;
  entry_price: number;
  current_price?: number;
  unrealized_pnl?: number;
  created_at: number;
  updated_at: number;
}

interface PositionsResponse {
  positions: Position[];
  count: number;
  timestamp: number;
}

interface UsePositionsOptions {
  refreshInterval?: number;
  enabled?: boolean;
}

export function usePositions(options: UsePositionsOptions = {}) {
  const { refreshInterval = 10000, enabled = true } = options;

  const [data, setData] = useState<Position[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchPositions = useCallback(async () => {
    if (!enabled) return;

    setLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/positions');
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      const result: PositionsResponse = await response.json();
      setData(result.positions);
    } catch (err) {
      setError(err as Error);
    } finally {
      setLoading(false);
    }
  }, [enabled]);

  useEffect(() => {
    fetchPositions();

    if (refreshInterval > 0) {
      const interval = setInterval(fetchPositions, refreshInterval);
      return () => clearInterval(interval);
    }
  }, [fetchPositions, refreshInterval]);

  return { data, loading, error, refetch: fetchPositions };
}
