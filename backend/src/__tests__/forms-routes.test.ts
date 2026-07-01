import { describe, it, expect, vi, beforeEach } from 'vitest'
import request from 'supertest'
import jwt from 'jsonwebtoken'
import { config } from '../config'
import { UserPayload } from '../middleware/auth'

const { mockSheetsGet, mockSheetsUpdate, mockSheetsAppend } = vi.hoisted(() => ({
  mockSheetsGet: vi.fn(),
  mockSheetsUpdate: vi.fn(),
  mockSheetsAppend: vi.fn(),
}))

vi.mock('../services/sheets', () => ({
  SheetsService: vi.fn().mockImplementation(function () {
    return {
      getRows: mockSheetsGet,
      updateCell: mockSheetsUpdate,
      appendRow: mockSheetsAppend,
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

function formsSheet(): string[][] {
  return [
    ['FormID', 'FormName', 'AgentID', 'PublicURL', 'EnabledFields', 'Active', 'CreatedAt'],
    ['FORM-ABC123', 'My Form', 'AG001', '/form/AG001/FORM-ABC123', '["fullName","email","passport"]', 'true', '2026-01-01T00:00:00.000Z'],
    ['FORM-DEF456', 'Another Form', 'AG002', '/form/AG002/FORM-DEF456', '["fullName","email"]', 'true', '2026-02-01T00:00:00.000Z'],
    ['FORM-GHI789', 'Inactive Form', 'AG001', '/form/AG001/FORM-GHI789', '["fullName"]', 'false', '2026-03-01T00:00:00.000Z'],
  ]
}

describe('GET /api/forms', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns 401 when not authenticated', async () => {
    const res = await request(app).get('/api/forms')

    expect(res.status).toBe(401)
  })

  it('returns only own forms for agent', async () => {
    mockSheetsGet.mockResolvedValue(formsSheet())
    const token = agentToken('AG001')

    const res = await request(app)
      .get('/api/forms')
      .set('Cookie', `session=${token}`)

    expect(res.status).toBe(200)
    expect(res.body.forms).toHaveLength(2)
    expect(res.body.forms.every((f: Record<string, string>) => f.AgentID === 'AG001')).toBe(true)
  })

  it('returns all forms for admin', async () => {
    mockSheetsGet.mockResolvedValue(formsSheet())
    const token = adminToken()

    const res = await request(app)
      .get('/api/forms')
      .set('Cookie', `session=${token}`)

    expect(res.status).toBe(200)
    expect(res.body.forms).toHaveLength(3)
  })

  it('filters by agentId query param for admin', async () => {
    mockSheetsGet.mockResolvedValue(formsSheet())
    const token = adminToken()

    const res = await request(app)
      .get('/api/forms?agentId=AG002')
      .set('Cookie', `session=${token}`)

    expect(res.status).toBe(200)
    expect(res.body.forms).toHaveLength(1)
    expect(res.body.forms[0].AgentID).toBe('AG002')
  })

  it('returns empty array when only headers exist', async () => {
    mockSheetsGet.mockResolvedValue([['FormID', 'FormName', 'AgentID']])
    const token = adminToken()

    const res = await request(app)
      .get('/api/forms')
      .set('Cookie', `session=${token}`)

    expect(res.status).toBe(200)
    expect(res.body.forms).toEqual([])
  })
})

describe('POST /api/forms', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns 401 when not authenticated', async () => {
    const res = await request(app)
      .post('/api/forms')
      .send({ formName: 'Test Form' })

    expect(res.status).toBe(401)
  })

  it('returns 400 when formName is missing', async () => {
    const token = agentToken()

    const res = await request(app)
      .post('/api/forms')
      .set('Cookie', `session=${token}`)
      .send({})

    expect(res.status).toBe(400)
  })

  it('creates form with default fields when enabledFields not provided', async () => {
    mockSheetsAppend.mockResolvedValue(undefined)
    const token = agentToken('AG001')

    const res = await request(app)
      .post('/api/forms')
      .set('Cookie', `session=${token}`)
      .send({ formName: 'My New Form' })

    expect(res.status).toBe(201)
    expect(res.body.form).toMatchObject({
      FormName: 'My New Form',
      AgentID: 'AG001',
      Active: true,
    })
    expect(res.body.form.FormID).toMatch(/^FORM-/)
    expect(res.body.form.PublicURL).toContain('/form/AG001/')
    expect(mockSheetsAppend).toHaveBeenCalledWith('Forms', [
      expect.stringMatching(/^FORM-/),
      'My New Form',
      'AG001',
      expect.stringContaining('/form/AG001/'),
      expect.any(String),
      'true',
      expect.any(String),
    ])
  })

  it('creates form with custom enabledFields', async () => {
    mockSheetsAppend.mockResolvedValue(undefined)
    const token = agentToken('AG001')

    const res = await request(app)
      .post('/api/forms')
      .set('Cookie', `session=${token}`)
      .send({ formName: 'Custom Fields', enabledFields: ['fullName', 'passport'] })

    expect(res.status).toBe(201)
    expect(res.body.form.EnabledFields).toEqual(['fullName', 'passport'])
    expect(mockSheetsAppend).toHaveBeenCalledWith('Forms', [
      expect.stringMatching(/^FORM-/),
      'Custom Fields',
      'AG001',
      expect.stringContaining('/form/AG001/'),
      JSON.stringify(['fullName', 'passport']),
      'true',
      expect.any(String),
    ])
  })

  it('admin can create forms too', async () => {
    mockSheetsAppend.mockResolvedValue(undefined)
    const token = adminToken({ agentId: 'ADM001' })

    const res = await request(app)
      .post('/api/forms')
      .set('Cookie', `session=${token}`)
      .send({ formName: 'Admin Form' })

    expect(res.status).toBe(201)
    expect(res.body.form.AgentID).toBe('ADM001')
  })
})

describe('PATCH /api/forms/:id', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns 401 when not authenticated', async () => {
    const res = await request(app)
      .patch('/api/forms/FORM-ABC123')
      .send({ formName: 'Updated' })

    expect(res.status).toBe(401)
  })

  it('updates form name', async () => {
    mockSheetsGet.mockResolvedValue(formsSheet())
    mockSheetsUpdate.mockResolvedValue(undefined)
    const token = agentToken('AG001')

    const res = await request(app)
      .patch('/api/forms/FORM-ABC123')
      .set('Cookie', `session=${token}`)
      .send({ formName: 'Updated Form Name' })

    expect(res.status).toBe(200)
    expect(res.body).toEqual({ success: true })
    expect(mockSheetsUpdate).toHaveBeenCalledWith('Forms', 2, 2, 'Updated Form Name')
  })

  it('updates enabledFields', async () => {
    mockSheetsGet.mockResolvedValue(formsSheet())
    mockSheetsUpdate.mockResolvedValue(undefined)
    const token = agentToken('AG001')

    const res = await request(app)
      .patch('/api/forms/FORM-ABC123')
      .set('Cookie', `session=${token}`)
      .send({ enabledFields: ['fullName', 'email', 'passport', 'programme'] })

    expect(res.status).toBe(200)
    expect(mockSheetsUpdate).toHaveBeenCalledWith('Forms', 2, 5, JSON.stringify(['fullName', 'email', 'passport', 'programme']))
  })

  it('updates active status', async () => {
    mockSheetsGet.mockResolvedValue(formsSheet())
    mockSheetsUpdate.mockResolvedValue(undefined)
    const token = agentToken('AG001')

    const res = await request(app)
      .patch('/api/forms/FORM-ABC123')
      .set('Cookie', `session=${token}`)
      .send({ active: false })

    expect(res.status).toBe(200)
    expect(mockSheetsUpdate).toHaveBeenCalledWith('Forms', 2, 6, 'false')
  })

  it('returns 403 when agent tries to update another agent form', async () => {
    mockSheetsGet.mockResolvedValue(formsSheet())
    const token = agentToken('AG001')

    const res = await request(app)
      .patch('/api/forms/FORM-DEF456')
      .set('Cookie', `session=${token}`)
      .send({ formName: 'Hacked' })

    expect(res.status).toBe(403)
  })

  it('returns 404 when form not found', async () => {
    mockSheetsGet.mockResolvedValue(formsSheet())
    const token = adminToken()

    const res = await request(app)
      .patch('/api/forms/NONEXISTENT')
      .set('Cookie', `session=${token}`)
      .send({ formName: 'Updated' })

    expect(res.status).toBe(404)
  })

  it('admin can update any form', async () => {
    mockSheetsGet.mockResolvedValue(formsSheet())
    mockSheetsUpdate.mockResolvedValue(undefined)
    const token = adminToken()

    const res = await request(app)
      .patch('/api/forms/FORM-DEF456')
      .set('Cookie', `session=${token}`)
      .send({ formName: 'Admin Edit' })

    expect(res.status).toBe(200)
    expect(mockSheetsUpdate).toHaveBeenCalledWith('Forms', 3, 2, 'Admin Edit')
  })
})

describe('DELETE /api/forms/:id', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns 401 when not authenticated', async () => {
    const res = await request(app).delete('/api/forms/FORM-ABC123')

    expect(res.status).toBe(401)
  })

  it('deactivates form (soft delete)', async () => {
    mockSheetsGet.mockResolvedValue(formsSheet())
    mockSheetsUpdate.mockResolvedValue(undefined)
    const token = agentToken('AG001')

    const res = await request(app)
      .delete('/api/forms/FORM-ABC123')
      .set('Cookie', `session=${token}`)

    expect(res.status).toBe(200)
    expect(res.body).toEqual({ success: true })
    expect(mockSheetsUpdate).toHaveBeenCalledWith('Forms', 2, 6, 'false')
  })

  it('returns 403 when agent tries to delete another agent form', async () => {
    mockSheetsGet.mockResolvedValue(formsSheet())
    const token = agentToken('AG001')

    const res = await request(app)
      .delete('/api/forms/FORM-DEF456')
      .set('Cookie', `session=${token}`)

    expect(res.status).toBe(403)
  })

  it('returns 404 when form not found', async () => {
    mockSheetsGet.mockResolvedValue(formsSheet())
    const token = adminToken()

    const res = await request(app)
      .delete('/api/forms/NONEXISTENT')
      .set('Cookie', `session=${token}`)

    expect(res.status).toBe(404)
  })

  it('admin can deactivate any form', async () => {
    mockSheetsGet.mockResolvedValue(formsSheet())
    mockSheetsUpdate.mockResolvedValue(undefined)
    const token = adminToken()

    const res = await request(app)
      .delete('/api/forms/FORM-DEF456')
      .set('Cookie', `session=${token}`)

    expect(res.status).toBe(200)
    expect(mockSheetsUpdate).toHaveBeenCalledWith('Forms', 3, 6, 'false')
  })
})
