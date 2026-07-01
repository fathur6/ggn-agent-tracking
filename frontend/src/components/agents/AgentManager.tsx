import { useState } from 'react'
import { useAgents, useCreateAgent, useUpdateAgent, useDeleteAgent } from '../../hooks/useAgents'
import { Button } from '../ui/button'
import { Input } from '../ui/input'
import { Label } from '../ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '../ui/dialog'
import { Card, CardContent } from '../ui/card'
import { Plus, MoreVertical } from 'lucide-react'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '../ui/dropdown-menu'
import { Badge } from '../ui/badge'
import { toast } from 'sonner'

export function AgentManager() {
  const { data: agents, isLoading } = useAgents()
  const createAgent = useCreateAgent()
  const updateAgent = useUpdateAgent()
  const deleteAgent = useDeleteAgent()
  const [open, setOpen] = useState(false)
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [role, setRole] = useState<'agent' | 'admin'>('agent')

  const handleCreate = async () => {
    try {
      await createAgent.mutateAsync({ name, email, role })
      toast.success('Agent added')
      setOpen(false)
      setName('')
      setEmail('')
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Failed')
    }
  }

  if (isLoading) return <div className="text-muted">Loading agents...</div>

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="text-lg font-semibold text-foreground">Agents</h2>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger render={<Button size="sm" />}>
            <Plus className="w-4 h-4 mr-1" /> Add Agent
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Add New Agent</DialogTitle></DialogHeader>
            <div className="space-y-4">
              <div>
                <Label>Name</Label>
                <Input value={name} onChange={e => setName(e.target.value)} />
              </div>
              <div>
                <Label>Email (Google account)</Label>
                <Input value={email} onChange={e => setEmail(e.target.value)} type="email" />
              </div>
              <div>
                <Label>Role</Label>
                <Select value={role} onValueChange={v => setRole(v as 'agent' | 'admin')}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="agent">Agent</SelectItem>
                    <SelectItem value="admin">Admin</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Button onClick={handleCreate} disabled={createAgent.isPending}>
                Create Agent
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {agents?.map(agent => (
          <Card key={agent.AgentID} className="bg-surface border-border">
            <CardContent className="p-4">
              <div className="flex justify-between items-start">
                <div>
                  <p className="font-medium text-foreground">{agent.Name}</p>
                  <p className="text-xs text-muted">{agent.Email}</p>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant={agent.Status === 'active' ? 'default' : 'secondary'}>
                    {agent.Status}
                  </Badge>
                  <DropdownMenu>
                    <DropdownMenuTrigger render={<Button variant="ghost" size="icon" />}>
                      <MoreVertical className="w-4 h-4" />
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => {
                        updateAgent.mutate({ id: agent.AgentID, status: agent.Status === 'active' ? 'suspended' : 'active' })
                        toast.success('Status updated')
                      }}>
                        {agent.Status === 'active' ? 'Suspend' : 'Activate'}
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => {
                        deleteAgent.mutate(agent.AgentID)
                        toast.success('Agent deactivated')
                      }} className="text-danger">
                        Deactivate
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}
