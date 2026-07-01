export interface User {
  agentId: string
  email: string
  name: string
  role: 'agent' | 'admin'
}

export interface Lead {
  ApplicationID: string
  Timestamp: string
  FullName: string
  Email: string
  Passport: string
  Nationality: string
  Structure: string
  Programme: string
  ProgrammeLevel: string
  Campaign: string
  AgentID: string
  AgentName: string
  FormID: string
  Status: string
  OfferPDF: string
  Notes: string
}

export interface Agent {
  AgentID: string
  Name: string
  Email: string
  Role: string
  Status: string
  FormsAssigned: string
  CreatedAt: string
}

export interface FormRecord {
  FormID: string
  FormName: string
  AgentID: string
  PublicURL: string
  EnabledFields: string
  Active: string
  CreatedAt: string
}

export interface DashboardSummary {
  totalLeads: number
  offersSent: number
  accepted: number
  enrolled: number
  conversionRate: number
}
