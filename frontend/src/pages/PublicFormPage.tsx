import { useParams } from 'react-router-dom'

export default function PublicFormPage() {
  const { agentId, formId } = useParams()
  return <div>Public Form: {agentId} / {formId}</div>
}
