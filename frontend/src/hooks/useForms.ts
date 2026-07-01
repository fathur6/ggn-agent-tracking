import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '../lib/api'
import type { FormRecord } from '../types'

export function useForms() {
  return useQuery({
    queryKey: ['forms'],
    queryFn: async () => {
      const { data } = await api.get('/forms')
      return data.forms as FormRecord[]
    },
  })
}

export function useCreateForm() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (form: { formName: string; enabledFields?: string[] }) => {
      const { data } = await api.post('/forms', form)
      return data
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['forms'] }) },
  })
}

export function useUpdateForm() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, ...updates }: { id: string; formName?: string; enabledFields?: string[]; active?: boolean }) => {
      const { data } = await api.patch(`/forms/${id}`, updates)
      return data
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['forms'] }) },
  })
}

export function useDeleteForm() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { data } = await api.delete(`/forms/${id}`)
      return data
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['forms'] }) },
  })
}
