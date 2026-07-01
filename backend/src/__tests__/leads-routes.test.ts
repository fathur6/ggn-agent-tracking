import { describe, it, expect, vi, beforeEach } from 'vitest'
import request from 'supertest'
import jwt from 'jsonwebtoken'
import { config } from '../config'
import { UserPayload } from '../middleware/auth'

const { mockSheetsGet, mockSheetsUpdate, mockSheetsAppend, mockSheetsEnsureHeader } = vi.hoisted(() => ({
  mockSheetsGet: vi.fn(),
  mockSheetsUpdate: vi.fn(),
  mockSheetsAppend: vi.fn(),
  mockSheetsEnsureHeader: vi.fn(),
}))

const { mockGenerateOffer } = vi.hoisted(() => ({
  mockGenerateOffer: vi.fn(),
}))

vi.mock('../services/sheets', () => ({
  SheetsService: vi.fn().mockImplementation(function () {
    return {
      getRows: mockSheetsGet,
      updateCell: mockSheetsUpdate,
      appendRow: mockSheetsAppend,
      ensureHeader: mockSheetsEnsureHeader,
    }
  }),
}))

vi.mock('../services/offerLetter', () => ({
  generateAndSendOffer: mockGenerateOffer,
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

function agentsSheet(): string[][] {
  return [
    ['AgentID', 'Name', 'Email', 'Role', 'Status'],
    ['AG001', 'Test Agent', 'agent@example.com', 'agent', 'Active'],
    ['AG002', 'Other Agent', 'other@example.com', 'agent', 'Active'],
  ]
}

function leadsSheet(): string[][] {
  return [
    ['ApplicationID', 'Timestamp', 'FullName', 'Email', 'Passport', 'Nationality', 'Structure', 'Programme', 'ProgrammeLevel', 'Campaign', 'AgentID', 'AgentName', 'FormID', 'Status', 'OfferPDF', 'Notes'],
    ['20260701-001', '2026-07-01T10:00:00.000Z', 'John Doe', 'john@example.com', 'A12345', 'MY', 'Science', 'PhD Chemistry', 'PHD', '', 'AG001', 'Test Agent', 'FORM-ABC123', 'Offer Sent', 'https://drive.example.com/pdf1', ''],
    ['20260701-002', '2026-07-01T11:00:00.000Z', 'Jane Smith', 'jane@example.com', 'B67890', 'ID', 'Arts', 'MA History', 'M', '', 'AG002', 'Other Agent', 'FORM-DEF456', 'Offer Sent', 'https://drive.example.com/pdf2', ''],
    ['20260702-001', '2026-07-02T09:00:00.000Z', 'Bob Wilson', 'bob@example.com', 'C54321', 'US', 'Engineering', 'MSc Engineering', 'M', '', 'AG001', 'Test Agent', 'FORM-GHI789', 'New', '', ''],
  ]
}

describe('POST /api/leads', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns 400 when required fields are missing', async () => {
    const res = await request(app)
      .post('/api/leads')
      .send({})

    expect(res.status).toBe(400)
  })

  it('returns 400 when email is invalid', async () => {
    const res = await request(app)
      .post('/api/leads')
      .send({
        fullName: 'Test',
        email: 'not-an-email',
        passport: 'P123',
        structure: 'Science',
        programme: 'PhD',
        agentId: 'AG001',
        formId: 'FORM-001',
      })

    expect(res.status).toBe(400)
  })

  it('returns 201 with applicationId and pdfUrl on success', async () => {
    mockSheetsGet.mockResolvedValue(agentsSheet())
    mockGenerateOffer.mockResolvedValue({
      applicationId: '20260702-001',
      pdfUrl: 'https://drive.example.com/offer.pdf',
    })

    const res = await request(app)
      .post('/api/leads')
      .send({
        fullName: 'John Doe',
        email: 'john@example.com',
        passport: 'A123456',
        structure: 'Science',
        programme: 'PhD Chemistry',
        agentId: 'AG001',
        formId: 'FORM-001',
      })

    expect(res.status).toBe(201)
    expect(res.body.applicationId).toBe('20260702-001')
    expect(res.body.pdfUrl).toBe('https://drive.example.com/offer.pdf')
  })

  it('looks up agent name from agents sheet', async () => {
    mockSheetsGet.mockResolvedValue(agentsSheet())
    mockGenerateOffer.mockResolvedValue({
      applicationId: '20260702-002',
      pdfUrl: 'https://drive.example.com/offer2.pdf',
    })

    const res = await request(app)
      .post('/api/leads')
      .send({
        fullName: 'Jane Smith',
        email: 'jane@example.com',
        passport: 'B67890',
        structure: 'Arts',
        programme: 'MA History',
        agentId: 'AG001',
        formId: 'FORM-002',
      })

    expect(res.status).toBe(201)
    expect(mockGenerateOffer).toHaveBeenCalledWith({
      fullName: 'Jane Smith',
      email: 'jane@example.com',
      passport: 'B67890',
      structure: 'Arts',
      programme: 'MA History',
      agentId: 'AG001',
      agentName: 'Test Agent',
      formId: 'FORM-002',
    })
  })

  it('uses "Unknown" when agent is not found', async () => {
    mockSheetsGet.mockResolvedValue(agentsSheet())
    mockGenerateOffer.mockResolvedValue({
      applicationId: '20260702-003',
      pdfUrl: 'https://drive.example.com/offer3.pdf',
    })

    const res = await request(app)
      .post('/api/leads')
      .send({
        fullName: 'Unknown Agent Lead',
        email: 'unknown@example.com',
        passport: 'C11111',
        structure: 'Business',
        programme: 'MBA',
        agentId: 'NONEXISTENT',
        formId: 'FORM-003',
      })

    expect(res.status).toBe(201)
    expect(mockGenerateOffer).toHaveBeenCalledWith(
      expect.objectContaining({ agentName: 'Unknown' }),
    )
  })
})

describe('GET /api/leads', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns 401 when not authenticated', async () => {
    const res = await request(app).get('/api/leads')

    expect(res.status).toBe(401)
  })

  it('returns only own leads for agent', async () => {
    mockSheetsGet.mockResolvedValue(leadsSheet())
    const token = agentToken('AG001')

    const res = await request(app)
      .get('/api/leads')
      .set('Cookie', `session=${token}`)

    expect(res.status).toBe(200)
    expect(res.body.leads).toHaveLength(2)
    expect(res.body.leads.every((l: Record<string, string>) => l.AgentID === 'AG001')).toBe(true)
  })

  it('returns all leads for admin', async () => {
    mockSheetsGet.mockResolvedValue(leadsSheet())
    const token = adminToken()

    const res = await request(app)
      .get('/api/leads')
      .set('Cookie', `session=${token}`)

    expect(res.status).toBe(200)
    expect(res.body.leads).toHaveLength(3)
  })

  it('filters by agentId query param for admin', async () => {
    mockSheetsGet.mockResolvedValue(leadsSheet())
    const token = adminToken()

    const res = await request(app)
      .get('/api/leads?agentId=AG002')
      .set('Cookie', `session=${token}`)

    expect(res.status).toBe(200)
    expect(res.body.leads).toHaveLength(1)
    expect(res.body.leads[0].AgentID).toBe('AG002')
  })

  it('sorts leads by timestamp descending', async () => {
    mockSheetsGet.mockResolvedValue(leadsSheet())
    const token = adminToken()

    const res = await request(app)
      .get('/api/leads')
      .set('Cookie', `session=${token}`)

    expect(res.status).toBe(200)
    expect(res.body.leads[0].ApplicationID).toBe('20260702-001')
    expect(res.body.leads[1].ApplicationID).toBe('20260701-002')
    expect(res.body.leads[2].ApplicationID).toBe('20260701-001')
  })

  it('returns empty array when only headers exist', async () => {
    mockSheetsGet.mockResolvedValue([['ApplicationID', 'Timestamp', 'AgentID']])
    const token = adminToken()

    const res = await request(app)
      .get('/api/leads')
      .set('Cookie', `session=${token}`)

    expect(res.status).toBe(200)
    expect(res.body.leads).toEqual([])
  })
})

describe('GET /api/leads/:appId', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns 401 when not authenticated', async () => {
    const res = await request(app).get('/api/leads/20260701-001')

    expect(res.status).toBe(401)
  })

  it('returns lead detail for authorized agent', async () => {
    mockSheetsGet.mockResolvedValue(leadsSheet())
    const token = agentToken('AG001')

    const res = await request(app)
      .get('/api/leads/20260701-001')
      .set('Cookie', `session=${token}`)

    expect(res.status).toBe(200)
    expect(res.body.lead.ApplicationID).toBe('20260701-001')
    expect(res.body.lead.FullName).toBe('John Doe')
  })

  it('returns 403 when agent tries to view another agent lead', async () => {
    mockSheetsGet.mockResolvedValue(leadsSheet())
    const token = agentToken('AG001')

    const res = await request(app)
      .get('/api/leads/20260701-002')
      .set('Cookie', `session=${token}`)

    expect(res.status).toBe(403)
  })

  it('returns 404 when lead not found', async () => {
    mockSheetsGet.mockResolvedValue(leadsSheet())
    const token = adminToken()

    const res = await request(app)
      .get('/api/leads/NONEXISTENT')
      .set('Cookie', `session=${token}`)

    expect(res.status).toBe(404)
  })

  it('admin can view any lead', async () => {
    mockSheetsGet.mockResolvedValue(leadsSheet())
    const token = adminToken()

    const res = await request(app)
      .get('/api/leads/20260701-002')
      .set('Cookie', `session=${token}`)

    expect(res.status).toBe(200)
    expect(res.body.lead.ApplicationID).toBe('20260701-002')
  })
})

describe('PATCH /api/leads/:appId', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns 401 when not authenticated', async () => {
    const res = await request(app)
      .patch('/api/leads/20260701-001')
      .send({ status: 'Contacted' })

    expect(res.status).toBe(401)
  })

  it('updates status for own lead', async () => {
    mockSheetsGet.mockResolvedValue(leadsSheet())
    mockSheetsUpdate.mockResolvedValue(undefined)
    const token = agentToken('AG001')

    const res = await request(app)
      .patch('/api/leads/20260701-001')
      .set('Cookie', `session=${token}`)
      .send({ status: 'Contacted' })

    expect(res.status).toBe(200)
    expect(res.body).toEqual({ success: true })
    expect(mockSheetsUpdate).toHaveBeenCalledWith('Leads', 2, 14, 'Contacted')
  })

  it('updates notes for own lead', async () => {
    mockSheetsGet.mockResolvedValue(leadsSheet())
    mockSheetsUpdate.mockResolvedValue(undefined)
    const token = agentToken('AG001')

    const res = await request(app)
      .patch('/api/leads/20260701-001')
      .set('Cookie', `session=${token}`)
      .send({ notes: 'Called prospect' })

    expect(res.status).toBe(200)
    expect(mockSheetsUpdate).toHaveBeenCalledWith('Leads', 2, 16, 'Called prospect')
  })

  it('updates both status and notes', async () => {
    mockSheetsGet.mockResolvedValue(leadsSheet())
    mockSheetsUpdate.mockResolvedValue(undefined)
    const token = agentToken('AG001')

    const res = await request(app)
      .patch('/api/leads/20260701-001')
      .set('Cookie', `session=${token}`)
      .send({ status: 'Contacted', notes: 'Follow up next week' })

    expect(res.status).toBe(200)
    expect(mockSheetsUpdate).toHaveBeenCalledTimes(2)
    expect(mockSheetsUpdate).toHaveBeenCalledWith('Leads', 2, 14, 'Contacted')
    expect(mockSheetsUpdate).toHaveBeenCalledWith('Leads', 2, 16, 'Follow up next week')
  })

  it('returns 403 when agent tries to update another agent lead', async () => {
    mockSheetsGet.mockResolvedValue(leadsSheet())
    const token = agentToken('AG001')

    const res = await request(app)
      .patch('/api/leads/20260701-002')
      .set('Cookie', `session=${token}`)
      .send({ status: 'Contacted' })

    expect(res.status).toBe(403)
  })

  it('returns 404 when lead not found', async () => {
    mockSheetsGet.mockResolvedValue(leadsSheet())
    const token = adminToken()

    const res = await request(app)
      .patch('/api/leads/NONEXISTENT')
      .set('Cookie', `session=${token}`)
      .send({ status: 'Contacted' })

    expect(res.status).toBe(404)
  })

  it('admin can update any lead', async () => {
    mockSheetsGet.mockResolvedValue(leadsSheet())
    mockSheetsUpdate.mockResolvedValue(undefined)
    const token = adminToken()

    const res = await request(app)
      .patch('/api/leads/20260701-002')
      .set('Cookie', `session=${token}`)
      .send({ status: 'Document Review' })

    expect(res.status).toBe(200)
    expect(mockSheetsUpdate).toHaveBeenCalledWith('Leads', 3, 14, 'Document Review')
  })

  it('returns 400 when status is not a string', async () => {
    mockSheetsGet.mockResolvedValue(leadsSheet())
    const token = agentToken('AG001')

    const res = await request(app)
      .patch('/api/leads/20260701-001')
      .set('Cookie', `session=${token}`)
      .send({ status: 123 })

    expect(res.status).toBe(400)
  })

  it('returns 400 when notes is not a string', async () => {
    mockSheetsGet.mockResolvedValue(leadsSheet())
    const token = agentToken('AG001')

    const res = await request(app)
      .patch('/api/leads/20260701-001')
      .set('Cookie', `session=${token}`)
      .send({ notes: true })

    expect(res.status).toBe(400)
  })
})
