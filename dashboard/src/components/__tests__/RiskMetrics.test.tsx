/**
 * RiskMetrics Component Tests
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import RiskMetrics from '../RiskMetrics';

// Mock the useRisk hook
vi.mock('../../hooks/useRisk', () => ({
  useRisk: vi.fn(),
}));

import { useRisk } from '../../hooks/useRisk';

describe('RiskMetrics', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows loading state initially', () => {
    vi.mocked(useRisk).mockReturnValue({
      data: null,
      loading: true,
      error: null,
      resetting: false,
      refetch: vi.fn(),
      resetCircuitBreaker: vi.fn(),
    });

    render(<RiskMetrics />);
    expect(screen.getByText(/loading risk metrics/i)).toBeInTheDocument();
  });

  it('displays risk metrics when loaded', () => {
    vi.mocked(useRisk).mockReturnValue({
      data: {
        dailyPnl: 1250.50,
        dailyPnlPercent: 1.25,
        consecutiveLosses: 0,
        circuitBreakerTriggered: false,
        lastUpdated: Date.now(),
      },
      loading: false,
      error: null,
      resetting: false,
      refetch: vi.fn(),
      resetCircuitBreaker: vi.fn(),
    });

    render(<RiskMetrics />);

    expect(screen.getByText('Risk Metrics')).toBeInTheDocument();
    expect(screen.getByText(/\+\$1250\.50/)).toBeInTheDocument();
  });

  it('shows circuit breaker as triggered when active', () => {
    vi.mocked(useRisk).mockReturnValue({
      data: {
        dailyPnl: -5000,
        dailyPnlPercent: -5,
        consecutiveLosses: 3,
        circuitBreakerTriggered: true,
        circuitBreakerReason: 'Daily loss limit exceeded',
        lastUpdated: Date.now(),
      },
      loading: false,
      error: null,
      resetting: false,
      refetch: vi.fn(),
      resetCircuitBreaker: vi.fn(),
    });

    render(<RiskMetrics />);

    expect(screen.getByText(/TRIGGERED/)).toBeInTheDocument();
    expect(screen.getByText(/Daily loss limit exceeded/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /reset circuit breaker/i })).toBeInTheDocument();
  });

  it('shows confirmation dialog when reset button is clicked', () => {
    const resetMock = vi.fn().mockResolvedValue(true);

    vi.mocked(useRisk).mockReturnValue({
      data: {
        dailyPnl: -5000,
        dailyPnlPercent: -5,
        consecutiveLosses: 3,
        circuitBreakerTriggered: true,
        lastUpdated: Date.now(),
      },
      loading: false,
      error: null,
      resetting: false,
      refetch: vi.fn(),
      resetCircuitBreaker: resetMock,
    });

    render(<RiskMetrics />);

    const resetButton = screen.getByRole('button', { name: /reset circuit breaker/i });
    fireEvent.click(resetButton);

    expect(screen.getByText(/are you sure/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /confirm reset/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /cancel/i })).toBeInTheDocument();
  });

  it('calls resetCircuitBreaker when confirmed', async () => {
    const resetMock = vi.fn().mockResolvedValue(true);

    vi.mocked(useRisk).mockReturnValue({
      data: {
        dailyPnl: -5000,
        dailyPnlPercent: -5,
        consecutiveLosses: 3,
        circuitBreakerTriggered: true,
        lastUpdated: Date.now(),
      },
      loading: false,
      error: null,
      resetting: false,
      refetch: vi.fn(),
      resetCircuitBreaker: resetMock,
    });

    render(<RiskMetrics />);

    const resetButton = screen.getByRole('button', { name: /reset circuit breaker/i });
    fireEvent.click(resetButton);

    const confirmButton = screen.getByRole('button', { name: /confirm reset/i });
    fireEvent.click(confirmButton);

    expect(resetMock).toHaveBeenCalledTimes(1);
  });

  it('shows high consecutive losses in red', () => {
    vi.mocked(useRisk).mockReturnValue({
      data: {
        dailyPnl: -500,
        dailyPnlPercent: -0.5,
        consecutiveLosses: 4,
        circuitBreakerTriggered: false,
        lastUpdated: Date.now(),
      },
      loading: false,
      error: null,
      resetting: false,
      refetch: vi.fn(),
      resetCircuitBreaker: vi.fn(),
    });

    render(<RiskMetrics />);

    const lossesElement = screen.getByText(/4/);
    expect(lossesElement).toHaveClass('text-red-400');
  });
});
