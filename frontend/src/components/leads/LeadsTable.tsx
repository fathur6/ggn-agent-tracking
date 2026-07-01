import { type ColumnDef } from '@tanstack/react-table'
import { DataTable } from '../shared/DataTable'
import { StatusBadge } from '../shared/StatusBadge'
import { useLeads } from '../../hooks/useLeads'
import type { Lead } from '../../types'

const columns: ColumnDef<Lead>[] = [
  { accessorKey: 'ApplicationID', header: 'App ID', cell: info => (
    <span className="font-mono text-xs">{info.getValue<string>()}</span>
  )},
  { accessorKey: 'FullName', header: 'Name' },
  { accessorKey: 'Programme', header: 'Programme', cell: info => (
    <span className="text-xs">{info.getValue<string>()}</span>
  )},
  { accessorKey: 'ProgrammeLevel', header: 'Level' },
  { accessorKey: 'Status', header: 'Status', cell: info => (
    <StatusBadge status={info.getValue<string>()} />
  )},
  { accessorKey: 'Timestamp', header: 'Date', cell: info => {
    const ts = info.getValue<string>()
    return ts ? new Date(ts).toLocaleDateString() : '-'
  }},
]

export function LeadsTable() {
  const { data: leads, isLoading } = useLeads()

  if (isLoading) return <div className="text-muted">Loading leads...</div>

  return <DataTable columns={columns} data={leads || []} searchPlaceholder="Search leads..." />
}
