/**
 * Dashboard Page
 * Main overview with all key metrics
 */

import AccountSummary from '../components/AccountSummary';
import PositionsTable from '../components/PositionsTable';
import RiskMetrics from '../components/RiskMetrics';
import SignalsPanel from '../components/SignalsPanel';

export default function DashboardPage() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-white mb-4">Dashboard</h2>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Account Summary */}
        <div className="lg:col-span-2">
          <AccountSummary />
        </div>

        {/* Risk Metrics */}
        <div>
          <RiskMetrics />
        </div>

        {/* Positions */}
        <div className="lg:col-span-2">
          <PositionsTable />
        </div>

        {/* Active Signals */}
        <div>
          <SignalsPanel />
        </div>
      </div>
    </div>
  );
}
