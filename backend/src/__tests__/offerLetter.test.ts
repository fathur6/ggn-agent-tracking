import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockSheetsApi = {
  spreadsheets: {
    values: {
      get: vi.fn(),
      append: vi.fn(),
      update: vi.fn(),
    },
  },
}

const mockDriveApi = {
  files: {
    copy: vi.fn(),
    export: vi.fn(),
    delete: vi.fn(),
  },
}

const mockDocsApi = {
  documents: {
    batchUpdate: vi.fn(),
  },
}

const mockGmailApi = {
  users: {
    messages: {
      send: vi.fn(),
    },
  },
}

vi.mock('googleapis', () => ({
  google: {
    sheets: vi.fn().mockImplementation(function () { return mockSheetsApi }),
    drive: vi.fn().mockImplementation(function () { return mockDriveApi }),
    docs: vi.fn().mockImplementation(function () { return mockDocsApi }),
    gmail: vi.fn().mockImplementation(function () { return mockGmailApi }),
    auth: {
      JWT: vi.fn().mockImplementation(function () { return {} }),
    },
  },
}))

import { generateAndSendOffer } from '../services/offerLetter'

const today = new Date()
const datePrefix = [
  today.getFullYear(),
  String(today.getMonth() + 1).padStart(2, '0'),
  String(today.getDate()).padStart(2, '0'),
].join('')

const defaultInput = {
  fullName: 'Abu Bakar',
  email: 'abu@example.com',
  passport: 'A12345678',
  structure: 'Research',
  programme: 'Master in Islamic Studies',
  agentId: 'agent-001',
  agentName: 'Agent Smith',
  formId: 'form-abc-123',
}

function setupDefaultMocks() {
  mockSheetsApi.spreadsheets.values.get.mockResolvedValue({
    data: {
      values: [
        ['Name', 'Email', 'ApplicationID'],
        ['Existing', 'e@b.com', `${datePrefix}-001`],
      ],
    },
  })
  mockSheetsApi.spreadsheets.values.update.mockResolvedValue({})
  mockSheetsApi.spreadsheets.values.append.mockResolvedValue({})

  mockDriveApi.files.copy.mockResolvedValue({ data: { id: 'copied-doc-456' } })
  mockDriveApi.files.export.mockResolvedValue({ data: Buffer.from('fake-pdf') })
  mockDriveApi.files.delete.mockResolvedValue({})

  mockDocsApi.documents.batchUpdate.mockResolvedValue({})

  mockGmailApi.users.messages.send.mockResolvedValue({})
}

describe('generateAndSendOffer', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    setupDefaultMocks()
  })

  it('generates an application ID and returns it with a PDF URL', async () => {
    const result = await generateAndSendOffer(defaultInput)

    expect(result.applicationId).toBe(`${datePrefix}-002`)
    expect(result.pdfUrl).toContain('copied-doc-456')
    expect(result.pdfUrl).toContain('drive.google.com')
  })

  it('copies the template, replaces placeholders, and exports PDF', async () => {
    await generateAndSendOffer(defaultInput)

    expect(mockDriveApi.files.copy).toHaveBeenCalledWith(
      expect.objectContaining({
        requestBody: expect.objectContaining({
          name: 'Conditional Offer - Abu Bakar',
        }),
      }),
    )

    expect(mockDocsApi.documents.batchUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        documentId: 'copied-doc-456',
        requestBody: expect.objectContaining({
          requests: expect.arrayContaining([
            expect.objectContaining({
              replaceAllText: expect.objectContaining({
                containsText: { text: '{{Reference}}', matchCase: true },
              }),
            }),
            expect.objectContaining({
              replaceAllText: expect.objectContaining({
                containsText: { text: '{{Name}}', matchCase: true },
              }),
            }),
            expect.objectContaining({
              replaceAllText: expect.objectContaining({
                containsText: { text: '{{Programme}}', matchCase: true },
              }),
            }),
          ]),
        }),
      }),
    )

    expect(mockDriveApi.files.export).toHaveBeenCalledWith(
      { fileId: 'copied-doc-456', mimeType: 'application/pdf' },
      { responseType: 'arraybuffer' },
    )
  })

  it('deletes the temp document after exporting PDF', async () => {
    await generateAndSendOffer(defaultInput)

    expect(mockDriveApi.files.delete).toHaveBeenCalledWith({ fileId: 'copied-doc-456' })
  })

  it('sends an email with the PDF attached', async () => {
    await generateAndSendOffer(defaultInput)

    expect(mockGmailApi.users.messages.send).toHaveBeenCalledTimes(1)

    const sendCall = mockGmailApi.users.messages.send.mock.calls[0][0]
    expect(sendCall.userId).toBe('me')

    const decoded = Buffer.from(
      sendCall.requestBody.raw.replace(/-/g, '+').replace(/_/g, '/'),
      'base64',
    ).toString()

    expect(decoded).toContain('To: abu@example.com')
    expect(decoded).toContain('Subject: =?UTF-8?B?')
    expect(decoded).toContain('Dear Abu Bakar,')
    expect(decoded).toContain(`Application ID: ${datePrefix}-002`)
    expect(decoded).toContain('Content-Type: application/pdf; name="UNISZA Conditional Offer - Abu Bakar.pdf"')
    expect(decoded).toContain('Content-Disposition: attachment')
  })

  it('appends a row to the Leads sheet with correct data', async () => {
    await generateAndSendOffer(defaultInput)

    expect(mockSheetsApi.spreadsheets.values.append).toHaveBeenCalledTimes(1)

    const appendCall = mockSheetsApi.spreadsheets.values.append.mock.calls[0][0]
    expect(appendCall.range).toBe('Leads')

    const values = appendCall.requestBody.values[0]
    expect(values[0]).toBe(`${datePrefix}-002`)
    expect(values[2]).toBe('Abu Bakar')
    expect(values[3]).toBe('abu@example.com')
  })

  it('detects PhD programme level when programme contains "doctor"', async () => {
    mockSheetsApi.spreadsheets.values.get.mockResolvedValue({
      data: {
        values: [
          ['Name', 'Email', 'ApplicationID'],
          ['Existing', 'e@b.com', `${datePrefix}-001`],
          ['Status', 'ProgrammeLevel', 'OfferPDF'],
        ],
      },
    })

    await generateAndSendOffer({
      ...defaultInput,
      programme: 'Doctor of Philosophy in Computer Science',
    })

    const appendCall = mockSheetsApi.spreadsheets.values.append.mock.calls[0][0]
    const values = appendCall.requestBody.values[0]
    const progLevelIdx = 8
    expect(values[progLevelIdx]).toBe('PHD')
  })

  it('detects PhD programme level when programme contains "ph.d"', async () => {
    mockSheetsApi.spreadsheets.values.get.mockResolvedValue({
      data: {
        values: [
          ['Name', 'Email', 'ApplicationID'],
          ['Existing', 'e@b.com', `${datePrefix}-001`],
          ['Status', 'ProgrammeLevel', 'OfferPDF'],
        ],
      },
    })

    await generateAndSendOffer({
      ...defaultInput,
      programme: 'Ph.D in Education',
    })

    const appendCall = mockSheetsApi.spreadsheets.values.append.mock.calls[0][0]
    const values = appendCall.requestBody.values[0]
    const progLevelIdx = 8
    expect(values[progLevelIdx]).toBe('PHD')
  })

  it('detects PhD programme level when programme contains "phd"', async () => {
    mockSheetsApi.spreadsheets.values.get.mockResolvedValue({
      data: {
        values: [
          ['Name', 'Email', 'ApplicationID'],
          ['Existing', 'e@b.com', `${datePrefix}-001`],
          ['Status', 'ProgrammeLevel', 'OfferPDF'],
        ],
      },
    })

    await generateAndSendOffer({
      ...defaultInput,
      programme: 'PhD in Mathematics',
    })

    const appendCall = mockSheetsApi.spreadsheets.values.append.mock.calls[0][0]
    const values = appendCall.requestBody.values[0]
    const progLevelIdx = 8
    expect(values[progLevelIdx]).toBe('PHD')
  })

  it('defaults programme level to M for master programmes', async () => {
    mockSheetsApi.spreadsheets.values.get.mockResolvedValue({
      data: {
        values: [
          ['Name', 'Email', 'ApplicationID'],
          ['Existing', 'e@b.com', `${datePrefix}-001`],
          ['Status', 'ProgrammeLevel', 'OfferPDF'],
        ],
      },
    })

    await generateAndSendOffer({
      ...defaultInput,
      programme: 'Master in Islamic Studies',
    })

    const appendCall = mockSheetsApi.spreadsheets.values.append.mock.calls[0][0]
    const values = appendCall.requestBody.values[0]
    const progLevelIdx = 8
    expect(values[progLevelIdx]).toBe('M')
  })

  it('ensures Status is set to "Offer Sent"', async () => {
    mockSheetsApi.spreadsheets.values.get.mockResolvedValue({
      data: {
        values: [
          ['Name', 'Email', 'ApplicationID'],
          ['Existing', 'e@b.com', `${datePrefix}-001`],
          ['Status', 'ProgrammeLevel', 'OfferPDF'],
        ],
      },
    })

    await generateAndSendOffer(defaultInput)

    const appendCall = mockSheetsApi.spreadsheets.values.append.mock.calls[0][0]
    const values = appendCall.requestBody.values[0]
    const statusIdx = 13
    expect(values[statusIdx]).toBe('Offer Sent')
  })

  it('ensures headers before appending', async () => {
    mockSheetsApi.spreadsheets.values.get
      .mockResolvedValueOnce({
        data: {
          values: [
            ['Name', 'Email', 'ApplicationID'],
            ['Existing', 'e@b.com', `${datePrefix}-001`],
          ],
        },
      })
      .mockResolvedValueOnce({
        data: { values: [['Name', 'Email', 'ApplicationID']] },
      })
      .mockResolvedValueOnce({
        data: { values: [['Name', 'Email', 'ApplicationID', 'ProgrammeLevel']] },
      })
      .mockResolvedValueOnce({
        data: {
          values: [
            ['Name', 'Email', 'ApplicationID', 'ProgrammeLevel', 'Status'],
          ],
        },
      })
      .mockResolvedValueOnce({
        data: {
          values: [
            ['Name', 'Email', 'ApplicationID', 'ProgrammeLevel', 'Status', 'OfferPDF'],
          ],
        },
      })

    await generateAndSendOffer(defaultInput)

    const updateCalls = mockSheetsApi.spreadsheets.values.update.mock.calls
    expect(updateCalls.length).toBeGreaterThan(0)
  })
})
