import { LeadsTable } from '../components/leads/LeadsTable'

export default function LeadsPage() {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-foreground">My Leads</h1>
      <LeadsTable />
    </div>
  )
}
