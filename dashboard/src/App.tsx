import React, { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Link, useLocation } from 'react-router-dom';
import AccountSummary from './components/AccountSummary';
import PositionsTable from './components/PositionsTable';
import RiskMetrics from './components/RiskMetrics';
import SignalsPanel from './components/SignalsPanel';
import DashboardPage from './pages/DashboardPage';
import TradesPage from './pages/TradesPage';
import SignalsPage from './pages/SignalsPage';
import PerformancePage from './pages/PerformancePage';
import SettingsPage from './pages/SettingsPage';

interface SystemStatus {
  status: string;
  environment?: string;
  circuitBreaker: {
    triggered: boolean;
    reason?: string | null;
    until?: number | null;
  };
  positions: { count: number };
  risk: {
    dailyPnl: number;
    dailyPnlPercent: number;
    consecutiveLosses: number;
  };
  timestamp: number;
}

function Navigation() {
  const location = useLocation();
  const isActive = (path: string) => location.pathname === path;

  const navItems = [
    { path: '/', label: 'Dashboard' },
    { path: '/trades', label: 'Trades' },
    { path: '/signals', label: 'Signals' },
    { path: '/performance', label: 'Performance' },
    { path: '/settings', label: 'Settings' },
  ];

  return (
    <nav className="flex gap-6">
      {navItems.map((item) => (
        <Link
          key={item.path}
          to={item.path}
          className={`text-sm font-medium transition-colors ${
            isActive(item.path)
              ? 'text-green-400'
              : 'text-gray-400 hover:text-gray-200'
          }`}
        >
          {item.label}
        </Link>
      ))}
    </nav>
  );
}

function AppHeader({ status }: { status: SystemStatus | null }) {
  return (
    <header className="bg-gray-800 border-b border-gray-700 px-6 py-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-8">
          <Link to="/" className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-green-400">NOISE</h1>
            <span className="text-sm text-gray-400">Algorithmic Trading Engine</span>
          </Link>
          <Navigation />
        </div>
        <div className="flex items-center gap-4">
          <span
            className={`px-2 py-1 rounded text-xs ${
              status?.circuitBreaker?.triggered ? 'bg-red-500' : 'bg-green-500'
            }`}
          >
            {status?.circuitBreaker?.triggered ? 'CIRCUIT BREAKER' : 'SYSTEM NORMAL'}
          </span>
          <span className="text-xs text-gray-500">
            {status?.environment === 'production' ? 'PROD' : 'DEV'}
          </span>
        </div>
      </div>
    </header>
  );
}

function App() {
  const [status, setStatus] = useState<SystemStatus | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchStatus = async () => {
      try {
        const response = await fetch('/api/status');
        const data = await response.json();
        setStatus(data);
      } catch (error) {
        console.error('Failed to fetch status:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchStatus();
    const interval = setInterval(fetchStatus, 30000);
    return () => clearInterval(interval);
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-white text-xl">Loading NOISE Dashboard...</div>
      </div>
    );
  }

  return (
    <BrowserRouter>
      <div className="min-h-screen bg-gray-900 text-gray-100 flex flex-col">
        <AppHeader status={status} />
        <main className="flex-1 p-6">
          <Routes>
            <Route path="/" element={<DashboardPage />} />
            <Route path="/trades" element={<TradesPage />} />
            <Route path="/signals" element={<SignalsPage />} />
            <Route path="/performance" element={<PerformancePage />} />
            <Route path="/settings" element={<SettingsPage />} />
          </Routes>
        </main>
      </div>
    </BrowserRouter>
  );
}

export default App;
