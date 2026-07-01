import { useUpdateForm } from '@/hooks/useForms'
import type { FormRecord } from '@/types'

interface FormBuilderProps {
  form: FormRecord
}

export function FormBuilder({ form }: FormBuilderProps) {
  const updateForm = useUpdateForm()

  const enabledFields: string[] = form.EnabledFields
    ? JSON.parse(form.EnabledFields)
    : []

  const availableFields = [
    { key: 'nationality', label: 'Nationality' },
    { key: 'campaign', label: 'Campaign' },
  ]

  const toggleField = (fieldKey: string) => {
    const current = new Set(enabledFields)
    if (current.has(fieldKey)) {
      current.delete(fieldKey)
    } else {
      current.add(fieldKey)
    }
    updateForm.mutate({
      id: form.FormID,
      enabledFields: Array.from(current),
    })
  }

  return (
    <div className="space-y-2">
      <h3 className="text-sm font-medium text-foreground">Toggleable Fields</h3>
      {availableFields.map((field) => {
        const isEnabled = enabledFields.includes(field.key)
        return (
          <label
            key={field.key}
            className="flex items-center gap-2 text-sm text-muted-foreground cursor-pointer"
          >
            <input
              type="checkbox"
              checked={isEnabled}
              onChange={() => toggleField(field.key)}
              className="rounded"
            />
            {field.label}
          </label>
        )
      })}
    </div>
  )
}
