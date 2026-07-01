import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '../lib/api'
import type { Lead, DashboardSummary } from '../types'

export function useLeads() {
  return useQuery({
    queryKey: ['leads'],
    queryFn: async () => {
      const { data } = await api.get('/leads')
      return data.leads as Lead[]
    },
  })
}

export function useLead(appId: string) {
  return useQuery({
    queryKey: ['lead', appId],
    queryFn: async () => {
      const { data } = await api.get(`/leads/${appId}`)
      return data.lead as Lead
    },
  })
}

export function useUpdateLead() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ appId, status, notes }: { appId: string; status?: string; notes?: string }) => {
      const { data } = await api.patch(`/leads/${appId}`, { status, notes })
      return data
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['leads'] }) },
  })
}

export function useDashboardSummary() {
  return useQuery({
    queryKey: ['dashboard', 'summary'],
    queryFn: async () => {
      const { data } = await api.get('/dashboard/summary')
      return data.summary as DashboardSummary
    },
  })
}
