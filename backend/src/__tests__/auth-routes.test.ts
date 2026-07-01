import { describe, it, expect, vi, beforeEach } from 'vitest'
import request from 'supertest'
import jwt from 'jsonwebtoken'
import { config } from '../config'
import { UserPayload } from '../middleware/auth'

const { mockVerifyIdToken, mockSheetsGet } = vi.hoisted(() => ({
  mockVerifyIdToken: vi.fn(),
  mockSheetsGet: vi.fn(),
}))

vi.mock('google-auth-library', () => ({
  OAuth2Client: vi.fn().mockImplementation(function () {
    return { verifyIdToken: mockVerifyIdToken }
  }),
}))

vi.mock('../services/sheets', () => ({
  SheetsService: vi.fn().mockImplementation(function () {
    return { getRows: mockSheetsGet }
  }),
}))

import app from '../app'

function validToken(user: Partial<UserPayload> = {}): string {
  return jwt.sign(
    {
      agentId: user.agentId || 'AG001',
      email: user.email || 'agent@example.com',
      name: user.name || 'Test Agent',
      role: user.role || 'agent',
    },
    config.jwtSecret,
    { expiresIn: '1h' },
  )
}

function agentRows(overrides: Record<string, string> = {}): string[][] {
  return [
    ['AgentID', 'Name', 'Email', 'Role', 'Status'],
    [
      overrides.agentId || 'AG001',
      overrides.name || 'Test Agent',
      overrides.email || 'agent@example.com',
      overrides.role || 'agent',
      overrides.status || 'Active',
    ],
  ]
}

describe('POST /api/auth/google', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns 400 when credential is missing', async () => {
    const res = await request(app)
      .post('/api/auth/google')
      .send({})

    expect(res.status).toBe(400)
    expect(res.body.error).toBe('Missing Google credential')
  })

  it('returns 400 when Google token is invalid', async () => {
    mockVerifyIdToken.mockRejectedValue(new Error('Invalid token'))

    const res = await request(app)
      .post('/api/auth/google')
      .send({ credential: 'invalid-credential' })

    expect(res.status).toBe(400)
    expect(res.body.error).toBe('Invalid Google token')
  })

  it('returns 403 when email is not in Agents sheet', async () => {
    mockVerifyIdToken.mockResolvedValue({
      getPayload: () => ({ email: 'unknown@example.com', name: 'Unknown' }),
    })
    mockSheetsGet.mockResolvedValue(agentRows({ email: 'other@example.com' }))

    const res = await request(app)
      .post('/api/auth/google')
      .send({ credential: 'google-credential' })

    expect(res.status).toBe(403)
    expect(res.body.error).toBe('Access denied. Contact UGS administrator.')
  })

  it('returns 403 when agent is not active', async () => {
    mockVerifyIdToken.mockResolvedValue({
      getPayload: () => ({ email: 'agent@example.com', name: 'Agent' }),
    })
    mockSheetsGet.mockResolvedValue(agentRows({ status: 'Inactive' }))

    const res = await request(app)
      .post('/api/auth/google')
      .send({ credential: 'google-credential' })

    expect(res.status).toBe(403)
    expect(res.body.error).toBe('Access denied. Contact UGS administrator.')
  })

  it('returns 200 with user and sets session cookie for valid agent', async () => {
    mockVerifyIdToken.mockResolvedValue({
      getPayload: () => ({ email: 'agent@example.com', name: 'Test Agent' }),
    })
    mockSheetsGet.mockResolvedValue(agentRows())

    const res = await request(app)
      .post('/api/auth/google')
      .send({ credential: 'google-credential' })

    expect(res.status).toBe(200)
    expect(res.body.user).toMatchObject({
      agentId: 'AG001',
      email: 'agent@example.com',
      name: 'Test Agent',
      role: 'agent',
    })

    const cookies = res.headers['set-cookie']
    expect(cookies).toBeDefined()
    const sessionCookie = Array.isArray(cookies)
      ? cookies.find((c: string) => c.startsWith('session='))
      : cookies?.toString().startsWith('session=') ? cookies.toString() : undefined
    expect(sessionCookie).toBeDefined()
    expect(sessionCookie).toContain('HttpOnly')
    expect(sessionCookie).toContain('SameSite=Lax')
  })

  it('returns 200 with admin role when sheet says admin', async () => {
    mockVerifyIdToken.mockResolvedValue({
      getPayload: () => ({ email: 'admin@example.com', name: 'Admin' }),
    })
    mockSheetsGet.mockResolvedValue(agentRows({
      email: 'admin@example.com',
      name: 'Admin User',
      role: 'admin',
    }))

    const res = await request(app)
      .post('/api/auth/google')
      .send({ credential: 'google-credential' })

    expect(res.status).toBe(200)
    expect(res.body.user.role).toBe('admin')
  })

  it('uses name from sheet if available, falls back to Google payload name', async () => {
    mockVerifyIdToken.mockResolvedValue({
      getPayload: () => ({ email: 'agent@example.com', name: 'Google Name' }),
    })
    mockSheetsGet.mockResolvedValue([
      ['AgentID', 'Name', 'Email', 'Role', 'Status'],
      ['AG001', '', 'agent@example.com', 'agent', 'Active'],
    ])

    const res = await request(app)
      .post('/api/auth/google')
      .send({ credential: 'google-credential' })

    expect(res.status).toBe(200)
    expect(res.body.user.name).toBe('Google Name')
  })

  it('is case-insensitive when matching email', async () => {
    mockVerifyIdToken.mockResolvedValue({
      getPayload: () => ({ email: 'Agent@Example.com', name: 'Agent' }),
    })
    mockSheetsGet.mockResolvedValue(agentRows({ email: 'agent@example.com' }))

    const res = await request(app)
      .post('/api/auth/google')
      .send({ credential: 'google-credential' })

    expect(res.status).toBe(200)
    expect(res.body.user.email).toBe('agent@example.com')
  })
})

describe('GET /api/auth/me', () => {
  it('returns 401 when not authenticated', async () => {
    const res = await request(app).get('/api/auth/me')

    expect(res.status).toBe(401)
  })

  it('returns user from JWT when authenticated', async () => {
    const token = validToken()

    const res = await request(app)
      .get('/api/auth/me')
      .set('Cookie', `session=${token}`)

    expect(res.status).toBe(200)
    expect(res.body.user).toMatchObject({
      agentId: 'AG001',
      email: 'agent@example.com',
      name: 'Test Agent',
      role: 'agent',
    })
  })

  it('returns 401 when JWT is expired', async () => {
    const expired = jwt.sign(
      { agentId: 'AG001', email: 'x@y.com', name: 'X', role: 'agent' as const },
      config.jwtSecret,
      { expiresIn: '0s' },
    )

    const res = await request(app)
      .get('/api/auth/me')
      .set('Cookie', `session=${expired}`)

    expect(res.status).toBe(401)
  })
})

describe('POST /api/auth/logout', () => {
  it('clears the session cookie and returns success', async () => {
    const res = await request(app).post('/api/auth/logout')

    expect(res.status).toBe(200)
    expect(res.body).toEqual({ success: true })

    const cookies = res.headers['set-cookie']
    expect(cookies).toBeDefined()
    const cookieStr = Array.isArray(cookies) ? cookies.join('; ') : String(cookies)
    expect(cookieStr).toContain('session=;')
  })
})
