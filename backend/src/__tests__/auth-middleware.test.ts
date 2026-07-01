import { describe, it, expect, vi, beforeEach } from 'vitest'
import jwt from 'jsonwebtoken'
import { Request, Response } from 'express'
import { authMiddleware, UserPayload } from '../middleware/auth'
import { config } from '../config'

function makeReq(cookie?: string): Partial<Request> {
  return {
    cookies: cookie ? { session: cookie } : {},
  }
}

describe('authMiddleware', () => {
  let next: ReturnType<typeof vi.fn>

  beforeEach(() => {
    next = vi.fn()
  })

  it('calls next with AppError 401 when no session cookie is present', () => {
    const req = makeReq() as Request

    authMiddleware(req, {} as Response, next as any)

    expect(next).toHaveBeenCalledWith(
      expect.objectContaining({ status: 401, message: 'Authentication required' }),
    )
  })

  it('calls next with AppError 401 when token is invalid', () => {
    const req = makeReq('invalid.token.here') as Request

    authMiddleware(req, {} as Response, next as any)

    expect(next).toHaveBeenCalledWith(
      expect.objectContaining({ status: 401, message: 'Invalid or expired session' }),
    )
  })

  it('calls next with AppError 401 when token is expired', () => {
    const expiredToken = jwt.sign(
      { agentId: '1', email: 'x@y.com', name: 'Test', role: 'agent' },
      config.jwtSecret,
      { expiresIn: '0s' },
    )
    const req = makeReq(expiredToken) as Request

    authMiddleware(req, {} as Response, next as any)

    expect(next).toHaveBeenCalledWith(
      expect.objectContaining({ status: 401, message: 'Invalid or expired session' }),
    )
  })

  it('attaches user to req and calls next() when token is valid', () => {
    const payload: UserPayload = {
      agentId: 'AG001',
      email: 'agent@example.com',
      name: 'Test Agent',
      role: 'agent',
    }
    const token = jwt.sign(payload, config.jwtSecret, { expiresIn: '1h' })
    const req = makeReq(token) as Request

    authMiddleware(req, {} as Response, next as any)

    expect(next).toHaveBeenCalledWith()
    expect(req.user).toMatchObject({
      agentId: 'AG001',
      email: 'agent@example.com',
      name: 'Test Agent',
      role: 'agent',
    })
  })

  it('attaches admin user correctly', () => {
    const payload: UserPayload = {
      agentId: 'AD001',
      email: 'admin@example.com',
      name: 'Admin User',
      role: 'admin',
    }
    const token = jwt.sign(payload, config.jwtSecret, { expiresIn: '1h' })
    const req = makeReq(token) as Request

    authMiddleware(req, {} as Response, next as any)

    expect(next).toHaveBeenCalledWith()
    expect(req.user?.role).toBe('admin')
  })

  it('preserves impersonatedAgentId in user payload', () => {
    const payload: UserPayload = {
      agentId: 'AD001',
      email: 'admin@example.com',
      name: 'Admin User',
      role: 'admin',
      impersonatedAgentId: 'AG007',
    }
    const token = jwt.sign(payload, config.jwtSecret, { expiresIn: '1h' })
    const req = makeReq(token) as Request

    authMiddleware(req, {} as Response, next as any)

    expect(next).toHaveBeenCalledWith()
    expect(req.user?.impersonatedAgentId).toBe('AG007')
  })
})
