import { describe, it, expect, vi, beforeEach } from 'vitest'
import { Request, Response } from 'express'
import { requireRole, requireAdmin } from '../middleware/authorize'
import { UserPayload } from '../middleware/auth'

function makeReq(user?: UserPayload): Partial<Request> {
  return { user }
}

describe('requireRole', () => {
  let next: ReturnType<typeof vi.fn>

  beforeEach(() => {
    next = vi.fn()
  })

  it('calls next with 401 when no user on request', () => {
    const middleware = requireRole('agent')
    const req = makeReq(undefined) as Request

    middleware(req, {} as Response, next as any)

    expect(next).toHaveBeenCalledWith(
      expect.objectContaining({ status: 401, message: 'Authentication required' }),
    )
  })

  it('calls next with 403 when user role is not in allowed roles', () => {
    const middleware = requireRole('admin')
    const req = makeReq({
      agentId: 'AG001',
      email: 'agent@example.com',
      name: 'Agent',
      role: 'agent',
    }) as Request

    middleware(req, {} as Response, next as any)

    expect(next).toHaveBeenCalledWith(
      expect.objectContaining({ status: 403, message: 'Insufficient permissions' }),
    )
  })

  it('calls next() when user role matches', () => {
    const middleware = requireRole('agent')
    const req = makeReq({
      agentId: 'AG001',
      email: 'agent@example.com',
      name: 'Agent',
      role: 'agent',
    }) as Request

    middleware(req, {} as Response, next as any)

    expect(next).toHaveBeenCalledWith()
  })

  it('calls next() when user role is one of multiple allowed roles', () => {
    const middleware = requireRole('agent', 'admin')
    const req = makeReq({
      agentId: 'AG001',
      email: 'agent@example.com',
      name: 'Agent',
      role: 'agent',
    }) as Request

    middleware(req, {} as Response, next as any)

    expect(next).toHaveBeenCalledWith()
  })

  it('allows admin through when admin is in list', () => {
    const middleware = requireRole('agent', 'admin')
    const req = makeReq({
      agentId: 'AD001',
      email: 'admin@example.com',
      name: 'Admin',
      role: 'admin',
    }) as Request

    middleware(req, {} as Response, next as any)

    expect(next).toHaveBeenCalledWith()
  })
})

describe('requireAdmin', () => {
  let next: ReturnType<typeof vi.fn>

  beforeEach(() => {
    next = vi.fn()
  })

  it('calls next with 401 when no user on request', () => {
    const req = makeReq(undefined) as Request

    requireAdmin(req, {} as Response, next as any)

    expect(next).toHaveBeenCalledWith(
      expect.objectContaining({ status: 401, message: 'Authentication required' }),
    )
  })

  it('calls next with 403 when user is agent', () => {
    const req = makeReq({
      agentId: 'AG001',
      email: 'agent@example.com',
      name: 'Agent',
      role: 'agent',
    }) as Request

    requireAdmin(req, {} as Response, next as any)

    expect(next).toHaveBeenCalledWith(
      expect.objectContaining({ status: 403, message: 'Insufficient permissions' }),
    )
  })

  it('calls next() when user is admin', () => {
    const req = makeReq({
      agentId: 'AD001',
      email: 'admin@example.com',
      name: 'Admin',
      role: 'admin',
    }) as Request

    requireAdmin(req, {} as Response, next as any)

    expect(next).toHaveBeenCalledWith()
  })
})
