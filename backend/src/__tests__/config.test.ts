import { describe, it, expect, beforeEach, vi } from 'vitest'

const originalEnv = { ...process.env }

describe('config', () => {
  beforeEach(() => {
    vi.resetModules()
    process.env = { ...originalEnv }
  })

  it('has default values when no env vars are set', async () => {
    delete process.env.PORT
    delete process.env.NODE_ENV
    delete process.env.FRONTEND_URL
    delete process.env.JWT_SECRET
    delete process.env.GOOGLE_CLIENT_ID
    delete process.env.SPREADSHEET_ID
    delete process.env.OFFER_TEMPLATE_DOC_ID
    delete process.env.OFFER_OUTPUT_FOLDER_ID
    delete process.env.GMAIL_USER
    delete process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL
    delete process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY

    const { config } = await import('../config')

    expect(config.port).toBe(8080)
    expect(config.nodeEnv).toBe('development')
    expect(config.frontendUrl).toBe('http://localhost:3000')
    expect(config.jwtSecret).toBe('change-me-in-production')
    expect(config.googleClientId).toBe('')
    expect(config.spreadsheetId).toBe('')
    expect(config.offerTemplateDocId).toBe('')
    expect(config.offerOutputFolderId).toBe('')
    expect(config.gmailUser).toBe('')
    expect(config.googleServiceAccountEmail).toBe('')
    expect(config.googleServiceAccountKey).toBe('')
  })

  it('uses PORT from environment', async () => {
    process.env.PORT = '3000'
    const { config } = await import('../config')

    expect(config.port).toBe(3000)
  })

  it('uses NODE_ENV from environment', async () => {
    process.env.NODE_ENV = 'production'
    const { config } = await import('../config')

    expect(config.nodeEnv).toBe('production')
  })
})
