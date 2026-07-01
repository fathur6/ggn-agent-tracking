import { SummaryCards } from '../components/dashboard/SummaryCards'
import { LeadsTable } from '../components/leads/LeadsTable'

export default function DashboardPage() {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-foreground">Dashboard</h1>
      <SummaryCards />
      <div>
        <h2 className="text-lg font-semibold text-foreground mb-4">Recent Leads</h2>
        <LeadsTable />
      </div>
    </div>
  )
}
