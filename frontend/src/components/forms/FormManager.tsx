import { useState } from 'react'
import { useForms, useCreateForm, useDeleteForm } from '@/hooks/useForms'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Card, CardContent } from '@/components/ui/card'
import { Plus, Copy, ExternalLink, Trash2 } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { toast } from 'sonner'

export function FormManager() {
  const { data: forms, isLoading } = useForms()
  const createForm = useCreateForm()
  const deleteForm = useDeleteForm()
  const [open, setOpen] = useState(false)
  const [formName, setFormName] = useState('')

  const handleCreate = async () => {
    try {
      await createForm.mutateAsync({ formName })
      toast.success('Form created')
      setOpen(false)
      setFormName('')
    } catch (err: unknown) {
      const error = err as { response?: { data?: { error?: string } } }
      toast.error(error.response?.data?.error || 'Failed')
    }
  }

  const copyLink = (url: string) => {
    const fullUrl = `${window.location.origin}${url}`
    navigator.clipboard.writeText(fullUrl)
    toast.success('Link copied!')
  }

  if (isLoading) return <div className="text-muted-foreground">Loading forms...</div>

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="text-lg font-semibold text-foreground">Forms</h2>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger render={<Button size="sm" />}>
            <Plus className="w-4 h-4 mr-1" /> New Form
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create New Form</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label>Form Name</Label>
                <Input
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  placeholder="e.g., UGS Tour KL 2026"
                />
              </div>
              <Button onClick={handleCreate} disabled={createForm.isPending}>
                Create
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {forms?.map((form) => (
          <Card key={form.FormID} className="bg-surface border-border">
            <CardContent className="p-4">
              <div className="flex justify-between items-start">
                <div>
                  <p className="font-medium text-foreground">{form.FormName}</p>
                  <p className="text-xs text-muted-foreground font-mono">{form.FormID}</p>
                </div>
                <Badge variant={form.Active === 'true' ? 'default' : 'secondary'}>
                  {form.Active === 'true' ? 'Active' : 'Inactive'}
                </Badge>
              </div>
              <div className="flex gap-2 mt-4">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => copyLink(form.PublicURL)}
                >
                  <Copy className="w-4 h-4 mr-1" /> Copy Link
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  render={
                    <a href={form.PublicURL} target="_blank" rel="noopener noreferrer" />
                  }
                >
                  <ExternalLink className="w-4 h-4 mr-1" /> Preview
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    deleteForm.mutate(form.FormID)
                    toast.success('Form deactivated')
                  }}
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}
