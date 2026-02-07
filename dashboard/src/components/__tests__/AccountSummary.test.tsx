/**
 * AccountSummary Component Tests
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import AccountSummary from '../AccountSummary';

// Mock the useAccount hook
vi.mock('../../hooks/useAccount', () => ({
  useAccount: vi.fn(),
}));

import { useAccount } from '../../hooks/useAccount';

describe('AccountSummary', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows loading state initially', () => {
    vi.mocked(useAccount).mockReturnValue({
      data: null,
      loading: true,
      error: null,
      refetch: vi.fn(),
    });

    render(<AccountSummary />);
    expect(screen.getByText(/loading account data/i)).toBeInTheDocument();
  });

  it('displays account data when loaded', () => {
    vi.mocked(useAccount).mockReturnValue({
      data: {
        equity: 100000,
        cash: 50000,
        buyingPower: 200000,
        dailyPnl: 1250.50,
        dailyPnlPercent: 1.25,
        lastUpdated: Date.now(),
      },
      loading: false,
      error: null,
      refetch: vi.fn(),
    });

    render(<AccountSummary />);

    expect(screen.getByText('Account Summary')).toBeInTheDocument();
    expect(screen.getByText('$100,000')).toBeInTheDocument(); // Total Equity
    expect(screen.getByText('$50,000')).toBeInTheDocument(); // Cash
    expect(screen.getByText('$200,000')).toBeInTheDocument(); // Buying Power
    expect(screen.getByText(/\+1250\.50/)).toBeInTheDocument(); // Daily P&L
  });

  it('shows error state when fetch fails', () => {
    vi.mocked(useAccount).mockReturnValue({
      data: null,
      loading: false,
      error: new Error('Failed to fetch'),
      refetch: vi.fn(),
    });

    render(<AccountSummary />);

    expect(screen.getByText('Failed to load account data')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Retry' })).toBeInTheDocument();
  });

  it('shows stale data warning when there was an error but data exists', () => {
    vi.mocked(useAccount).mockReturnValue({
      data: {
        equity: 100000,
        cash: 50000,
        buyingPower: 200000,
        dailyPnl: 1250.50,
        dailyPnlPercent: 1.25,
        lastUpdated: Date.now(),
      },
      loading: false,
      error: new Error('Network error'),
      refetch: vi.fn(),
    });

    render(<AccountSummary />);

    expect(screen.getByText(/stale/i)).toBeInTheDocument();
  });

  it('displays negative P&L correctly', () => {
    vi.mocked(useAccount).mockReturnValue({
      data: {
        equity: 98750,
        cash: 50000,
        buyingPower: 200000,
        dailyPnl: -1250,
        dailyPnlPercent: -1.25,
        lastUpdated: Date.now(),
      },
      loading: false,
      error: null,
      refetch: vi.fn(),
    });

    render(<AccountSummary />);

    expect(screen.getByText(/-1250\.00/)).toBeInTheDocument();
    expect(screen.getByText(/\(-1\.25%\)/)).toBeInTheDocument();
  });

  it('calls refetch when retry button is clicked', async () => {
    const refetchMock = vi.fn();

    vi.mocked(useAccount).mockReturnValue({
      data: null,
      loading: false,
      error: new Error('Failed'),
      refetch: refetchMock,
    });

    render(<AccountSummary />);

    const retryButton = screen.getByRole('button', { name: 'Retry' });
    retryButton.click();

    expect(refetchMock).toHaveBeenCalledTimes(1);
  });
});
