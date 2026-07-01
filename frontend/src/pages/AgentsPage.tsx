import { useAuth } from '../lib/auth'
import { AgentManager } from '../components/agents/AgentManager'
import { Navigate } from 'react-router-dom'

export default function AgentsPage() {
  const { user } = useAuth()
  if (user?.role !== 'admin') return <Navigate to="/dashboard" replace />

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-foreground">Agent Management</h1>
      <AgentManager />
    </div>
  )
}
