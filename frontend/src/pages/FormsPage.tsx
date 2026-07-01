import { FormManager } from '@/components/forms/FormManager'

export default function FormsPage() {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-foreground">My Forms</h1>
      <FormManager />
    </div>
  )
}
