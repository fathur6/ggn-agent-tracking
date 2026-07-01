import { describe, it, expect, vi, beforeEach } from 'vitest'
import request from 'supertest'
import jwt from 'jsonwebtoken'
import { config } from '../config'
import { UserPayload } from '../middleware/auth'

const { mockSheetsGet, mockSheetsAppend, mockSheetsUpdate } = vi.hoisted(() => ({
  mockSheetsGet: vi.fn(),
  mockSheetsAppend: vi.fn(),
  mockSheetsUpdate: vi.fn(),
}))

vi.mock('../services/sheets', () => ({
  SheetsService: vi.fn().mockImplementation(function () {
    return {
      getRows: mockSheetsGet,
      appendRow: mockSheetsAppend,
      updateCell: mockSheetsUpdate,
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

function agentToken(overrides: Partial<UserPayload> = {}): string {
  return jwt.sign(
    {
      agentId: overrides.agentId || 'AG001',
      email: overrides.email || 'agent@example.com',
      name: overrides.name || 'Test Agent',
      role: 'agent',
    },
    config.jwtSecret,
    { expiresIn: '1h' },
  )
}

function agentsSheet(): string[][] {
  return [
    ['AgentID', 'Name', 'Email', 'Role', 'Status', 'Scopes', 'CreatedAt'],
    ['ADM001', 'Admin User', 'admin@example.com', 'admin', 'active', '', '2024-01-01T00:00:00.000Z'],
    ['AG001', 'Test Agent', 'agent@example.com', 'agent', 'active', '', '2024-01-02T00:00:00.000Z'],
    ['AG002', 'Suspended Agent', 'suspended@example.com', 'agent', 'suspended', '', '2024-01-03T00:00:00.000Z'],
  ]
}

describe('GET /api/agents', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns 401 when not authenticated', async () => {
    const res = await request(app).get('/api/agents')

    expect(res.status).toBe(401)
  })

  it('returns 401 when token is expired', async () => {
    const expired = jwt.sign(
      { agentId: 'ADM001', email: 'x@y.com', name: 'X', role: 'admin' as const },
      config.jwtSecret,
      { expiresIn: '0s' },
    )

    const res = await request(app)
      .get('/api/agents')
      .set('Cookie', `session=${expired}`)

    expect(res.status).toBe(401)
  })

  it('returns 403 when user is not an admin', async () => {
    const token = agentToken()

    const res = await request(app)
      .get('/api/agents')
      .set('Cookie', `session=${token}`)

    expect(res.status).toBe(403)
  })

  it('returns list of agents for admin', async () => {
    mockSheetsGet.mockResolvedValue(agentsSheet())
    const token = adminToken()

    const res = await request(app)
      .get('/api/agents')
      .set('Cookie', `session=${token}`)

    expect(res.status).toBe(200)
    expect(res.body.agents).toHaveLength(3)
    expect(res.body.agents[0]).toMatchObject({
      AgentID: 'ADM001',
      Name: 'Admin User',
      Email: 'admin@example.com',
      Role: 'admin',
      Status: 'active',
    })
    expect(res.body.agents[1]).toMatchObject({
      AgentID: 'AG001',
      Name: 'Test Agent',
      Email: 'agent@example.com',
      Role: 'agent',
      Status: 'active',
    })
  })

  it('returns empty array when only headers exist', async () => {
    mockSheetsGet.mockResolvedValue([['AgentID', 'Name', 'Email', 'Role', 'Status']])
    const token = adminToken()

    const res = await request(app)
      .get('/api/agents')
      .set('Cookie', `session=${token}`)

    expect(res.status).toBe(200)
    expect(res.body.agents).toEqual([])
  })
})

describe('POST /api/agents', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns 401 when not authenticated', async () => {
    const res = await request(app)
      .post('/api/agents')
      .send({ name: 'New Agent', email: 'new@example.com', role: 'agent' })

    expect(res.status).toBe(401)
  })

  it('returns 403 when user is not an admin', async () => {
    const token = agentToken()

    const res = await request(app)
      .post('/api/agents')
      .set('Cookie', `session=${token}`)
      .send({ name: 'New Agent', email: 'new@example.com', role: 'agent' })

    expect(res.status).toBe(403)
  })

  it('returns 400 when name is missing', async () => {
    const token = adminToken()

    const res = await request(app)
      .post('/api/agents')
      .set('Cookie', `session=${token}`)
      .send({ email: 'new@example.com', role: 'agent' })

    expect(res.status).toBe(400)
  })

  it('returns 400 when email is invalid', async () => {
    const token = adminToken()

    const res = await request(app)
      .post('/api/agents')
      .set('Cookie', `session=${token}`)
      .send({ name: 'New Agent', email: 'not-an-email', role: 'agent' })

    expect(res.status).toBe(400)
  })

  it('returns 400 when role is invalid', async () => {
    const token = adminToken()

    const res = await request(app)
      .post('/api/agents')
      .set('Cookie', `session=${token}`)
      .send({ name: 'New Agent', email: 'new@example.com', role: 'superuser' })

    expect(res.status).toBe(400)
  })

  it('creates agent and returns 201 with agent data', async () => {
    mockSheetsAppend.mockResolvedValue(undefined)
    const token = adminToken()

    const res = await request(app)
      .post('/api/agents')
      .set('Cookie', `session=${token}`)
      .send({ name: 'New Agent', email: 'new@example.com', role: 'agent' })

    expect(res.status).toBe(201)
    expect(res.body.agent).toMatchObject({
      name: 'New Agent',
      email: 'new@example.com',
      role: 'agent',
      Status: 'active',
    })
    expect(res.body.agent.AgentID).toMatch(/^AGT/)
    expect(mockSheetsAppend).toHaveBeenCalledWith('Agents', [
      expect.stringMatching(/^AGT/),
      'New Agent',
      'new@example.com',
      'agent',
      'active',
      '',
      expect.any(String),
    ])
  })

  it('creates agent with admin role', async () => {
    mockSheetsAppend.mockResolvedValue(undefined)
    const token = adminToken()

    const res = await request(app)
      .post('/api/agents')
      .set('Cookie', `session=${token}`)
      .send({ name: 'New Admin', email: 'newadmin@example.com', role: 'admin' })

    expect(res.status).toBe(201)
    expect(res.body.agent.role).toBe('admin')
  })
})

describe('PATCH /api/agents/:id', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns 401 when not authenticated', async () => {
    const res = await request(app)
      .patch('/api/agents/AG001')
      .send({ name: 'Updated' })

    expect(res.status).toBe(401)
  })

  it('returns 403 when user is not an admin', async () => {
    const token = agentToken()

    const res = await request(app)
      .patch('/api/agents/AG001')
      .set('Cookie', `session=${token}`)
      .send({ name: 'Updated' })

    expect(res.status).toBe(403)
  })

  it('returns 400 when status is invalid', async () => {
    const token = adminToken()

    const res = await request(app)
      .patch('/api/agents/AG001')
      .set('Cookie', `session=${token}`)
      .send({ status: 'banned' })

    expect(res.status).toBe(400)
  })

  it('returns 400 when role is invalid', async () => {
    const token = adminToken()

    const res = await request(app)
      .patch('/api/agents/AG001')
      .set('Cookie', `session=${token}`)
      .send({ role: 'superuser' })

    expect(res.status).toBe(400)
  })

  it('returns 404 when agent not found', async () => {
    mockSheetsGet.mockResolvedValue(agentsSheet())
    mockSheetsUpdate.mockResolvedValue(undefined)
    const token = adminToken()

    const res = await request(app)
      .patch('/api/agents/NONEXISTENT')
      .set('Cookie', `session=${token}`)
      .send({ name: 'Updated' })

    expect(res.status).toBe(404)
    expect(res.body.error).toBe('Agent not found')
  })

  it('updates agent name', async () => {
    mockSheetsGet.mockResolvedValue(agentsSheet())
    mockSheetsUpdate.mockResolvedValue(undefined)
    const token = adminToken()

    const res = await request(app)
      .patch('/api/agents/AG001')
      .set('Cookie', `session=${token}`)
      .send({ name: 'Updated Name' })

    expect(res.status).toBe(200)
    expect(res.body).toEqual({ success: true })
    expect(mockSheetsUpdate).toHaveBeenCalledWith('Agents', 3, 2, 'Updated Name')
  })

  it('updates agent role', async () => {
    mockSheetsGet.mockResolvedValue(agentsSheet())
    mockSheetsUpdate.mockResolvedValue(undefined)
    const token = adminToken()

    const res = await request(app)
      .patch('/api/agents/AG001')
      .set('Cookie', `session=${token}`)
      .send({ role: 'admin' })

    expect(res.status).toBe(200)
    expect(res.body).toEqual({ success: true })
    expect(mockSheetsUpdate).toHaveBeenCalledWith('Agents', 3, 4, 'admin')
  })

  it('updates agent status', async () => {
    mockSheetsGet.mockResolvedValue(agentsSheet())
    mockSheetsUpdate.mockResolvedValue(undefined)
    const token = adminToken()

    const res = await request(app)
      .patch('/api/agents/AG001')
      .set('Cookie', `session=${token}`)
      .send({ status: 'suspended' })

    expect(res.status).toBe(200)
    expect(res.body).toEqual({ success: true })
    expect(mockSheetsUpdate).toHaveBeenCalledWith('Agents', 3, 5, 'suspended')
  })

  it('updates multiple fields at once', async () => {
    mockSheetsGet.mockResolvedValue(agentsSheet())
    mockSheetsUpdate.mockResolvedValue(undefined)
    const token = adminToken()

    const res = await request(app)
      .patch('/api/agents/AG001')
      .set('Cookie', `session=${token}`)
      .send({ name: 'New Name', role: 'admin', status: 'suspended' })

    expect(res.status).toBe(200)
    expect(res.body).toEqual({ success: true })
    expect(mockSheetsUpdate).toHaveBeenCalledTimes(3)
    expect(mockSheetsUpdate).toHaveBeenCalledWith('Agents', 3, 2, 'New Name')
    expect(mockSheetsUpdate).toHaveBeenCalledWith('Agents', 3, 4, 'admin')
    expect(mockSheetsUpdate).toHaveBeenCalledWith('Agents', 3, 5, 'suspended')
  })

  it('returns 400 when no valid fields provided', async () => {
    mockSheetsGet.mockResolvedValue(agentsSheet())
    const token = adminToken()

    const res = await request(app)
      .patch('/api/agents/AG001')
      .set('Cookie', `session=${token}`)
      .send({})

    expect(res.status).toBe(200)
    expect(res.body).toEqual({ success: true })
  })
})

describe('DELETE /api/agents/:id', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns 401 when not authenticated', async () => {
    const res = await request(app).delete('/api/agents/AG001')

    expect(res.status).toBe(401)
  })

  it('returns 403 when user is not an admin', async () => {
    const token = agentToken()

    const res = await request(app)
      .delete('/api/agents/AG001')
      .set('Cookie', `session=${token}`)

    expect(res.status).toBe(403)
  })

  it('returns 404 when agent not found', async () => {
    mockSheetsGet.mockResolvedValue(agentsSheet())
    mockSheetsUpdate.mockResolvedValue(undefined)
    const token = adminToken()

    const res = await request(app)
      .delete('/api/agents/NONEXISTENT')
      .set('Cookie', `session=${token}`)

    expect(res.status).toBe(404)
    expect(res.body.error).toBe('Agent not found')
  })

  it('soft-deletes agent by setting status to inactive', async () => {
    mockSheetsGet.mockResolvedValue(agentsSheet())
    mockSheetsUpdate.mockResolvedValue(undefined)
    const token = adminToken()

    const res = await request(app)
      .delete('/api/agents/AG001')
      .set('Cookie', `session=${token}`)

    expect(res.status).toBe(200)
    expect(res.body).toEqual({ success: true })
    expect(mockSheetsUpdate).toHaveBeenCalledWith('Agents', 3, 5, 'inactive')
  })

  it('soft-deletes first matching agent by ID', async () => {
    mockSheetsGet.mockResolvedValue(agentsSheet())
    mockSheetsUpdate.mockResolvedValue(undefined)
    const token = adminToken()

    const res = await request(app)
      .delete('/api/agents/ADM001')
      .set('Cookie', `session=${token}`)

    expect(res.status).toBe(200)
    expect(res.body).toEqual({ success: true })
    expect(mockSheetsUpdate).toHaveBeenCalledWith('Agents', 2, 5, 'inactive')
  })
})
