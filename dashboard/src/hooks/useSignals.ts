/**
 * useSignals Hook
 * Fetches signals with automatic refresh
 */

import { useState, useEffect, useCallback } from 'react';

export interface Signal {
  id: string;
  symbol: string;
  asset_class: string;
  timeframe: string;
  direction: 'LONG' | 'SHORT' | 'NEUTRAL';
  strength: number;
  entry_price: number;
  stop_loss: number;
  take_profit?: number;
  source: string;
  strategy: string;
  status: 'ACTIVE' | 'EXPIRED' | 'EXECUTED' | 'CANCELLED';
  reasons: string;
  timestamp: number;
  expires_at: number;
}

interface SignalsResponse {
  signals: Signal[];
  count: number;
  timestamp: number;
}

interface UseSignalsOptions {
  refreshInterval?: number;
  enabled?: boolean;
  activeOnly?: boolean;
  symbol?: string;
  strategy?: string;
}

export function useSignals(options: UseSignalsOptions = {}) {
  const {
    refreshInterval = 30000,
    enabled = true,
    activeOnly = false,
    symbol,
    strategy,
  } = options;

  const [data, setData] = useState<Signal[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchSignals = useCallback(async () => {
    if (!enabled) return;

    setLoading(true);
    setError(null);

    try {
      const url = new URL('/api/signals', window.location.origin);

      if (activeOnly) {
        // Use active signals endpoint
        const response = await fetch('/api/signals/active');
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        const result: SignalsResponse = await response.json();
        setData(result.signals);
      } else {
        // Use full signals endpoint with filters
        if (symbol) url.searchParams.set('symbol', symbol);
        if (strategy) url.searchParams.set('strategy', strategy);

        const response = await fetch(url.toString());
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        const result: SignalsResponse = await response.json();
        setData(result.signals);
      }
    } catch (err) {
      setError(err as Error);
    } finally {
      setLoading(false);
    }
  }, [enabled, activeOnly, symbol, strategy]);

  useEffect(() => {
    fetchSignals();

    if (refreshInterval > 0) {
      const interval = setInterval(fetchSignals, refreshInterval);
      return () => clearInterval(interval);
    }
  }, [fetchSignals, refreshInterval]);

  return { data, loading, error, refetch: fetchSignals };
}
