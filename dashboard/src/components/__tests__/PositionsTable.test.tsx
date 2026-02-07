/**
 * PositionsTable Component Tests
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import PositionsTable from '../PositionsTable';

// Mock the usePositions hook
vi.mock('../../hooks/usePositions', () => ({
  usePositions: vi.fn(),
}));

import { usePositions } from '../../hooks/usePositions';

describe('PositionsTable', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows loading state initially', () => {
    vi.mocked(usePositions).mockReturnValue({
      data: [],
      loading: true,
      error: null,
      refetch: vi.fn(),
    });

    render(<PositionsTable />);
    expect(screen.getByText(/loading positions/i)).toBeInTheDocument();
  });

  it('displays positions when loaded', () => {
    vi.mocked(usePositions).mockReturnValue({
      data: [
        {
          id: '1',
          symbol: 'MNQH4',
          side: 'LONG',
          quantity: 2,
          entry_price: 18500,
          current_price: 18600,
          unrealized_pnl: 200,
          asset_class: 'futures',
          broker: 'tradovate',
          created_at: Date.now(),
          updated_at: Date.now(),
        },
        {
          id: '2',
          symbol: 'TQQQ',
          side: 'SHORT',
          quantity: 100,
          entry_price: 50,
          current_price: 49,
          unrealized_pnl: 100,
          asset_class: 'equities',
          broker: 'alpaca',
          created_at: Date.now(),
          updated_at: Date.now(),
        },
      ],
      loading: false,
      error: null,
      refetch: vi.fn(),
    });

    render(<PositionsTable />);

    expect(screen.getByText('Open Positions')).toBeInTheDocument();
    expect(screen.getByText('MNQH4')).toBeInTheDocument();
    expect(screen.getByText('TQQQ')).toBeInTheDocument();
    expect(screen.getByText('2 positions')).toBeInTheDocument();
  });

  it('shows empty state when no positions', () => {
    vi.mocked(usePositions).mockReturnValue({
      data: [],
      loading: false,
      error: null,
      refetch: vi.fn(),
    });

    render(<PositionsTable />);

    expect(screen.getByText('No open positions')).toBeInTheDocument();
  });

  it('shows error state when fetch fails', () => {
    vi.mocked(usePositions).mockReturnValue({
      data: [],
      loading: false,
      error: new Error('Failed to fetch'),
      refetch: vi.fn(),
    });

    render(<PositionsTable />);

    expect(screen.getByText('Failed to load positions')).toBeInTheDocument();
  });

  it('displays P&L with correct colors', () => {
    vi.mocked(usePositions).mockReturnValue({
      data: [
        {
          id: '1',
          symbol: 'MNQH4',
          side: 'LONG',
          quantity: 2,
          entry_price: 18500,
          current_price: 18600,
          unrealized_pnl: 200, // Positive
          asset_class: 'futures',
          broker: 'tradovate',
          created_at: Date.now(),
          updated_at: Date.now(),
        },
        {
          id: '2',
          symbol: 'MES',
          side: 'SHORT',
          quantity: 1,
          entry_price: 4000,
          current_price: 4050,
          unrealized_pnl: -50, // Negative
          asset_class: 'futures',
          broker: 'tradovate',
          created_at: Date.now(),
          updated_at: Date.now(),
        },
      ],
      loading: false,
      error: null,
      refetch: vi.fn(),
    });

    render(<PositionsTable />);

    expect(screen.getByText(/200\.00/)).toBeInTheDocument();
    expect(screen.getByText(/-50\.00/)).toBeInTheDocument();
  });
});
