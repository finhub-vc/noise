/**
 * useAccount Hook
 * Fetches account data with automatic refresh
 */

import { useState, useEffect, useCallback } from 'react';

export interface AccountData {
  equity: number;
  cash: number;
  buyingPower: number;
  dailyPnl: number;
  dailyPnlPercent: number;
  lastUpdated: number;
}

interface UseAccountOptions {
  refreshInterval?: number;
  enabled?: boolean;
}

export function useAccount(options: UseAccountOptions = {}) {
  const { refreshInterval = 30000, enabled = true } = options;

  const [data, setData] = useState<AccountData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchAccount = useCallback(async () => {
    if (!enabled) return;

    setLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/account');
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      const accountData = await response.json();
      setData(accountData);
    } catch (err) {
      setError(err as Error);
    } finally {
      setLoading(false);
    }
  }, [enabled]);

  useEffect(() => {
    fetchAccount();

    if (refreshInterval > 0) {
      const interval = setInterval(fetchAccount, refreshInterval);
      return () => clearInterval(interval);
    }
  }, [fetchAccount, refreshInterval]);

  return { data, loading, error, refetch: fetchAccount };
}
