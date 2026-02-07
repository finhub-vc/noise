/**
 * SignalsPanel Component Tests
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import SignalsPanel from '../SignalsPanel';

// Mock the useSignals hook
vi.mock('../../hooks/useSignals', () => ({
  useSignals: vi.fn(),
}));

import { useSignals } from '../../hooks/useSignals';

describe('SignalsPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows loading state initially', () => {
    vi.mocked(useSignals).mockReturnValue({
      data: [],
      loading: true,
      error: null,
      refetch: vi.fn(),
    });

    render(<SignalsPanel />);
    expect(screen.getByText(/loading signals/i)).toBeInTheDocument();
  });

  it('displays signals when loaded', () => {
    vi.mocked(useSignals).mockReturnValue({
      data: [
        {
          id: '1',
          symbol: 'MNQH4',
          direction: 'LONG',
          strength: 0.85,
          entry_price: 18500,
          stop_loss: 18400,
          take_profit: 18800,
          source: 'Momentum Strategy',
          strategy: 'momentum',
          timeframe: '15m',
          asset_class: 'futures',
          status: 'ACTIVE',
          reasons: 'RSI oversold + MACD crossover',
          timestamp: Date.now(),
          expires_at: Date.now() + 3600000,
        },
      ],
      loading: false,
      error: null,
      refetch: vi.fn(),
    });

    render(<SignalsPanel />);

    expect(screen.getByText('Active Signals')).toBeInTheDocument();
    expect(screen.getByText('MNQH4')).toBeInTheDocument();
    expect(screen.getByText('85%')).toBeInTheDocument();
    expect(screen.getByText('momentum')).toBeInTheDocument();
  });

  it('shows empty state when no signals', () => {
    vi.mocked(useSignals).mockReturnValue({
      data: [],
      loading: false,
      error: null,
      refetch: vi.fn(),
    });

    render(<SignalsPanel />);

    expect(screen.getByText('No active signals')).toBeInTheDocument();
  });

  it('shows error state when fetch fails', () => {
    vi.mocked(useSignals).mockReturnValue({
      data: [],
      loading: false,
      error: new Error('Failed to fetch'),
      refetch: vi.fn(),
    });

    render(<SignalsPanel />);

    expect(screen.getByText('Failed to load signals')).toBeInTheDocument();
  });

  it('displays LONG signals with green color', () => {
    vi.mocked(useSignals).mockReturnValue({
      data: [
        {
          id: '1',
          symbol: 'MNQH4',
          direction: 'LONG',
          strength: 0.85,
          entry_price: 18500,
          stop_loss: 18400,
          source: 'Momentum',
          strategy: 'momentum',
          timeframe: '15m',
          asset_class: 'futures',
          status: 'ACTIVE',
          reasons: 'Bullish',
          timestamp: Date.now(),
          expires_at: Date.now() + 3600000,
        },
      ],
      loading: false,
      error: null,
      refetch: vi.fn(),
    });

    render(<SignalsPanel />);

    expect(screen.getByText('LONG')).toBeInTheDocument();
  });

  it('displays SHORT signals with red color', () => {
    vi.mocked(useSignals).mockReturnValue({
      data: [
        {
          id: '1',
          symbol: 'MES',
          direction: 'SHORT',
          strength: 0.75,
          entry_price: 4000,
          stop_loss: 4050,
          source: 'Mean Reversion',
          strategy: 'meanReversion',
          timeframe: '5m',
          asset_class: 'futures',
          status: 'ACTIVE',
          reasons: 'Overbought',
          timestamp: Date.now(),
          expires_at: Date.now() + 3600000,
        },
      ],
      loading: false,
      error: null,
      refetch: vi.fn(),
    });

    render(<SignalsPanel />);

    expect(screen.getByText('SHORT')).toBeInTheDocument();
  });

  it('does not display take profit if not provided', () => {
    vi.mocked(useSignals).mockReturnValue({
      data: [
        {
          id: '1',
          symbol: 'MNQH4',
          direction: 'LONG',
          strength: 0.85,
          entry_price: 18500,
          stop_loss: 18400,
          // take_profit not provided
          source: 'Momentum',
          strategy: 'momentum',
          timeframe: '15m',
          asset_class: 'futures',
          status: 'ACTIVE',
          reasons: 'Bullish',
          timestamp: Date.now(),
          expires_at: Date.now() + 3600000,
        },
      ],
      loading: false,
      error: null,
      refetch: vi.fn(),
    });

    render(<SignalsPanel />);

    // Check that entry and stop are shown but target is not
    expect(screen.getByText(/Entry:/i)).toBeInTheDocument();
    expect(screen.getByText(/Stop:/i)).toBeInTheDocument();
    expect(screen.queryByText(/Target:/i)).not.toBeInTheDocument();
  });
});
