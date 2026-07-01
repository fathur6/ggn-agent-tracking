import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockDocsApi = {
  documents: {
    batchUpdate: vi.fn(),
  },
}

vi.mock('googleapis', () => ({
  google: {
    docs: vi.fn().mockImplementation(function () { return mockDocsApi }),
    auth: {
      JWT: vi.fn().mockImplementation(function () { return {} }),
    },
  },
}))

import { DocsService } from '../services/docs'

describe('DocsService', () => {
  let service: DocsService

  beforeEach(() => {
    vi.clearAllMocks()
    service = new DocsService()
  })

  describe('replacePlaceholders', () => {
    it('sends batchUpdate with replaceAllText requests', async () => {
      mockDocsApi.documents.batchUpdate.mockResolvedValue({})

      await service.replacePlaceholders('doc-123', {
        '{{NAME}}': 'Alice',
        '{{DATE}}': '2024-01-01',
      })

      expect(mockDocsApi.documents.batchUpdate).toHaveBeenCalledWith({
        documentId: 'doc-123',
        requestBody: {
          requests: [
            {
              replaceAllText: {
                containsText: { text: '{{NAME}}', matchCase: true },
                replaceText: 'Alice',
              },
            },
            {
              replaceAllText: {
                containsText: { text: '{{DATE}}', matchCase: true },
                replaceText: '2024-01-01',
              },
            },
          ],
        },
      })
    })

    it('sends empty requests array when no replacements', async () => {
      mockDocsApi.documents.batchUpdate.mockResolvedValue({})

      await service.replacePlaceholders('doc-123', {})

      expect(mockDocsApi.documents.batchUpdate).toHaveBeenCalledWith({
        documentId: 'doc-123',
        requestBody: { requests: [] },
      })
    })
  })
})
