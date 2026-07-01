import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '../lib/api'
import type { Agent } from '../types'

export function useAgents() {
  return useQuery({
    queryKey: ['agents'],
    queryFn: async () => {
      const { data } = await api.get('/agents')
      return data.agents as Agent[]
    },
  })
}

export function useCreateAgent() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (agent: { name: string; email: string; role: string }) => {
      const { data } = await api.post('/agents', agent)
      return data
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['agents'] }) },
  })
}

export function useUpdateAgent() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, ...updates }: { id: string; name?: string; role?: string; status?: string }) => {
      const { data } = await api.patch(`/agents/${id}`, updates)
      return data
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['agents'] }) },
  })
}

export function useDeleteAgent() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { data } = await api.delete(`/agents/${id}`)
      return data
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['agents'] }) },
  })
}
