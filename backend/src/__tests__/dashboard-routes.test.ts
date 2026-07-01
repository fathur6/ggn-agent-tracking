import { describe, it, expect, vi, beforeEach } from 'vitest'
import request from 'supertest'
import jwt from 'jsonwebtoken'
import { config } from '../config'
import { UserPayload } from '../middleware/auth'

const { mockSheetsGet } = vi.hoisted(() => ({
  mockSheetsGet: vi.fn(),
}))

vi.mock('../services/sheets', () => ({
  SheetsService: vi.fn().mockImplementation(function () {
    return {
      getRows: mockSheetsGet,
    }
  }),
}))

import app from '../app'

function adminToken(overrides: Partial<UserPayload> = {}): string {
  return jwt.sign(
    {
      agentId: overrides.agentId || 'ADM001',
      email: overrides.email || 'admin@example.com',
      name: overrides.name || 'Admin User',
      role: 'admin',
    },
    config.jwtSecret,
    { expiresIn: '1h' },
  )
}

function agentToken(agentId = 'AG001'): string {
  return jwt.sign(
    { agentId, email: 'agent@example.com', name: 'Test Agent', role: 'agent' as const },
    config.jwtSecret,
    { expiresIn: '1h' },
  )
}

function leadsSheet(): string[][] {
  return [
    ['ApplicationID', 'Timestamp', 'FullName', 'Email', 'Passport', 'Nationality', 'Structure', 'Programme', 'ProgrammeLevel', 'Campaign', 'AgentID', 'AgentName', 'FormID', 'Status', 'OfferPDF', 'Notes'],
    ['20260701-001', '2026-07-01T10:00:00.000Z', 'John Doe', 'john@example.com', 'A12345', 'MY', 'Science', 'PhD Chemistry', 'PHD', '', 'AG001', 'Test Agent', 'FORM-ABC123', 'Offer Sent', 'https://drive.example.com/pdf1', ''],
    ['20260701-002', '2026-07-01T11:00:00.000Z', 'Jane Smith', 'jane@example.com', 'B67890', 'ID', 'Arts', 'MA History', 'M', '', 'AG002', 'Other Agent', 'FORM-DEF456', 'Accepted', 'https://drive.example.com/pdf2', ''],
    ['20260702-001', '2026-07-02T09:00:00.000Z', 'Bob Wilson', 'bob@example.com', 'C54321', 'US', 'Engineering', 'MSc Engineering', 'M', '', 'AG001', 'Test Agent', 'FORM-GHI789', 'New', '', ''],
    ['20260702-002', '2026-07-02T10:00:00.000Z', 'Alice Lee', 'alice@example.com', 'D11111', 'SG', 'Medicine', 'MBBS', 'B', '', 'AG001', 'Test Agent', 'FORM-JKL012', 'Enrolled', 'https://drive.example.com/pdf3', ''],
  ]
}

describe('GET /api/dashboard/summary', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns 401 when not authenticated', async () => {
    const res = await request(app).get('/api/dashboard/summary')

    expect(res.status).toBe(401)
  })

  it('returns agent-scoped stats when logged in as agent', async () => {
    mockSheetsGet.mockResolvedValue(leadsSheet())
    const token = agentToken('AG001')

    const res = await request(app)
      .get('/api/dashboard/summary')
      .set('Cookie', `session=${token}`)

    expect(res.status).toBe(200)
    expect(res.body.summary).toBeDefined()
    expect(res.body.summary.totalLeads).toBe(3)
    expect(res.body.summary.offersSent).toBe(2)
    expect(res.body.summary.accepted).toBe(1)
    expect(res.body.summary.enrolled).toBe(1)
    expect(res.body.summary.conversionRate).toBe(33)
  })

  it('returns all stats when logged in as admin', async () => {
    mockSheetsGet.mockResolvedValue(leadsSheet())
    const token = adminToken()

    const res = await request(app)
      .get('/api/dashboard/summary')
      .set('Cookie', `session=${token}`)

    expect(res.status).toBe(200)
    expect(res.body.summary.totalLeads).toBe(4)
    expect(res.body.summary.offersSent).toBe(3)
    expect(res.body.summary.accepted).toBe(2)
    expect(res.body.summary.enrolled).toBe(1)
    expect(res.body.summary.conversionRate).toBe(50)
  })

  it('filters by agentId query param for admin', async () => {
    mockSheetsGet.mockResolvedValue(leadsSheet())
    const token = adminToken()

    const res = await request(app)
      .get('/api/dashboard/summary?agentId=AG002')
      .set('Cookie', `session=${token}`)

    expect(res.status).toBe(200)
    expect(res.body.summary.totalLeads).toBe(1)
    expect(res.body.summary.offersSent).toBe(1)
    expect(res.body.summary.accepted).toBe(1)
    expect(res.body.summary.enrolled).toBe(0)
    expect(res.body.summary.conversionRate).toBe(100)
  })

  it('returns zero stats when only headers exist', async () => {
    mockSheetsGet.mockResolvedValue([['ApplicationID', 'Timestamp', 'AgentID', 'Status']])
    const token = adminToken()

    const res = await request(app)
      .get('/api/dashboard/summary')
      .set('Cookie', `session=${token}`)

    expect(res.status).toBe(200)
    expect(res.body.summary.totalLeads).toBe(0)
    expect(res.body.summary.offersSent).toBe(0)
    expect(res.body.summary.accepted).toBe(0)
    expect(res.body.summary.enrolled).toBe(0)
    expect(res.body.summary.conversionRate).toBe(0)
  })

  it('returns 0% conversion rate when no accepted leads', async () => {
    const noAcceptedSheet = [
      ['ApplicationID', 'Timestamp', 'AgentID', 'FullName', 'Email', 'Status'],
      ['20260701-001', '2026-07-01T10:00:00.000Z', 'AG001', 'John Doe', 'john@example.com', 'New'],
      ['20260701-002', '2026-07-01T11:00:00.000Z', 'AG001', 'Jane Smith', 'jane@example.com', 'Offer Sent'],
    ]
    mockSheetsGet.mockResolvedValue(noAcceptedSheet)
    const token = agentToken('AG001')

    const res = await request(app)
      .get('/api/dashboard/summary')
      .set('Cookie', `session=${token}`)

    expect(res.status).toBe(200)
    expect(res.body.summary.totalLeads).toBe(2)
    expect(res.body.summary.offersSent).toBe(1)
    expect(res.body.summary.accepted).toBe(0)
    expect(res.body.summary.enrolled).toBe(0)
    expect(res.body.summary.conversionRate).toBe(0)
  })
})
