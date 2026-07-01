import { describe, it, expect } from 'vitest'
import request from 'supertest'
import app from '../app'

describe('GET /api/health', () => {
  it('returns 200 with status ok and ISO timestamp', async () => {
    const res = await request(app).get('/api/health')

    expect(res.status).toBe(200)
    expect(res.body).toEqual({
      status: 'ok',
      timestamp: expect.any(String),
    })
    expect(new Date(res.body.timestamp).toISOString()).toBe(res.body.timestamp)
  })
})

describe('CORS', () => {
  it('sets access-control-allow-origin header', async () => {
    const res = await request(app).options('/api/health')
      .set('Origin', 'http://localhost:3000')

    expect(res.headers['access-control-allow-origin']).toBe('http://localhost:3000')
  })
})

describe('security headers', () => {
  it('sets common helmet security headers', async () => {
    const res = await request(app).get('/api/health')

    expect(res.headers['x-content-type-options']).toBe('nosniff')
    expect(res.headers['x-frame-options']).toBe('SAMEORIGIN')
  })
})

describe('404 handler', () => {
  it('returns 404 with AppError body for unknown routes', async () => {
    const res = await request(app).get('/api/nonexistent')

    expect(res.status).toBe(404)
    expect(res.body).toEqual({
      error: 'Not found',
    })
  })
})
