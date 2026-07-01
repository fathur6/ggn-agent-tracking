import { useDashboardSummary } from '../../hooks/useLeads'
import { Users, Send, CheckCircle, TrendingUp } from 'lucide-react'
import { Card, CardContent } from '../ui/card'

export function SummaryCards() {
  const { data, isLoading } = useDashboardSummary()

  const cards = [
    { label: 'Total Leads', value: data?.totalLeads ?? 0, icon: Users, color: 'text-blue-400' },
    { label: 'Offers Sent', value: data?.offersSent ?? 0, icon: Send, color: 'text-amber-400' },
    { label: 'Accepted', value: data?.accepted ?? 0, icon: CheckCircle, color: 'text-emerald-400' },
    { label: 'Conversion', value: `${data?.conversionRate ?? 0}%`, icon: TrendingUp, color: 'text-primary' },
  ]

  if (isLoading) return <div className="text-muted text-sm">Loading...</div>

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {cards.map(card => (
        <Card key={card.label} className="bg-surface border-border">
          <CardContent className="p-4 flex items-center gap-4">
            <card.icon className={`w-8 h-8 ${card.color}`} />
            <div>
              <p className="text-xs text-muted uppercase tracking-wider">{card.label}</p>
              <p className="text-2xl font-bold text-foreground">{card.value}</p>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}
