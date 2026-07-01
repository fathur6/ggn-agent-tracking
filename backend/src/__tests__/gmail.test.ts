import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockGmailApi = {
  users: {
    messages: {
      send: vi.fn(),
    },
  },
}

vi.mock('googleapis', () => ({
  google: {
    gmail: vi.fn().mockImplementation(function () { return mockGmailApi }),
    auth: {
      JWT: vi.fn().mockImplementation(function () { return {} }),
    },
  },
}))

import { GmailService } from '../services/gmail'

describe('GmailService', () => {
  let service: GmailService

  beforeEach(() => {
    vi.clearAllMocks()
    service = new GmailService()
  })

  describe('sendEmailWithAttachment', () => {
    it('sends an email with attachment via Gmail API', async () => {
      mockGmailApi.users.messages.send.mockResolvedValue({})

      await service.sendEmailWithAttachment({
        to: 'recipient@example.com',
        subject: 'Test Subject',
        body: 'Hello world',
        attachment: {
          filename: 'test.pdf',
          content: Buffer.from('PDF content'),
          mimeType: 'application/pdf',
        },
      })

      const sendCall = mockGmailApi.users.messages.send.mock.calls[0][0]

      expect(sendCall.userId).toBe('me')
      expect(sendCall.requestBody.raw).toEqual(expect.any(String))

      const decoded = Buffer.from(
        sendCall.requestBody.raw.replace(/-/g, '+').replace(/_/g, '/'),
        'base64',
      ).toString()

      expect(decoded).toContain('From:')
      expect(decoded).toContain('To: recipient@example.com')
      expect(decoded).toContain('Subject: =?UTF-8?B?')
      expect(decoded).toContain('Hello world')
      expect(decoded).toContain('Content-Type: application/pdf; name="test.pdf"')
      expect(decoded).toContain('Content-Disposition: attachment')
      expect(decoded).toContain('Content-Transfer-Encoding: base64')
      expect(decoded).toContain(
        Buffer.from('PDF content').toString('base64'),
      )
    })

    it('encodes subject as base64', async () => {
      mockGmailApi.users.messages.send.mockResolvedValue({})

      await service.sendEmailWithAttachment({
        to: 'recipient@example.com',
        subject: 'Fiançaillersøkning',
        body: 'Body',
        attachment: {
          filename: 'doc.pdf',
          content: Buffer.from('data'),
          mimeType: 'application/pdf',
        },
      })

      const sendCall = mockGmailApi.users.messages.send.mock.calls[0][0]
      const decoded = Buffer.from(
        sendCall.requestBody.raw.replace(/-/g, '+').replace(/_/g, '/'),
        'base64',
      ).toString()

      expect(decoded).toContain(
        `Subject: =?UTF-8?B?${Buffer.from('Fiançaillersøkning').toString('base64')}?=`,
      )
    })
  })
})
