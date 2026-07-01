import { cn } from '../../lib/utils'

interface StatusBadgeProps {
  status: string
}

const statusColors: Record<string, string> = {
  'New Lead': 'bg-blue-500/10 text-blue-400 border-blue-500/30',
  'Offer Sent': 'bg-amber-500/10 text-amber-400 border-amber-500/30',
  'Accepted': 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30',
  'Enrolled': 'bg-primary/10 text-primary border-primary/30',
  'Declined': 'bg-destructive/10 text-destructive border-destructive/30',
}

export function StatusBadge({ status }: StatusBadgeProps) {
  return (
    <span className={cn(
      'inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border',
      statusColors[status] || 'bg-muted/10 text-muted border-muted/30',
    )}>
      {status}
    </span>
  )
}
