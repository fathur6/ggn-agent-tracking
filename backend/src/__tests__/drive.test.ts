import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockDriveApi = {
  files: {
    copy: vi.fn(),
    export: vi.fn(),
    delete: vi.fn(),
    get: vi.fn(),
  },
}

vi.mock('googleapis', () => ({
  google: {
    drive: vi.fn().mockImplementation(function () { return mockDriveApi }),
    auth: {
      JWT: vi.fn().mockImplementation(function () { return {} }),
    },
  },
}))

import { DriveService } from '../services/drive'

describe('DriveService', () => {
  let service: DriveService

  beforeEach(() => {
    vi.clearAllMocks()
    service = new DriveService()
  })

  describe('copyTemplate', () => {
    it('copies a template file and returns the new file id', async () => {
      mockDriveApi.files.copy.mockResolvedValue({
        data: { id: 'new-file-123' },
      })

      const newId = await service.copyTemplate('template-1', 'My Copy', 'folder-1')

      expect(newId).toBe('new-file-123')
      expect(mockDriveApi.files.copy).toHaveBeenCalledWith({
        fileId: 'template-1',
        requestBody: {
          name: 'My Copy',
          parents: ['folder-1'],
        },
      })
    })
  })

  describe('exportPdf', () => {
    it('exports a file as PDF and returns a Buffer', async () => {
      const fakeBuffer = new Uint8Array([1, 2, 3]).buffer
      mockDriveApi.files.export.mockResolvedValue({ data: fakeBuffer })

      const result = await service.exportPdf('file-123')

      expect(Buffer.isBuffer(result)).toBe(true)
      expect(result).toEqual(Buffer.from(fakeBuffer))
      expect(mockDriveApi.files.export).toHaveBeenCalledWith(
        { fileId: 'file-123', mimeType: 'application/pdf' },
        { responseType: 'arraybuffer' },
      )
    })
  })

  describe('deleteFile', () => {
    it('deletes a file by id', async () => {
      mockDriveApi.files.delete.mockResolvedValue({})

      await service.deleteFile('file-123')

      expect(mockDriveApi.files.delete).toHaveBeenCalledWith({ fileId: 'file-123' })
    })
  })

  describe('getFileUrl', () => {
    it('returns the Google Drive viewer URL', async () => {
      const url = await service.getFileUrl('file-123')

      expect(url).toBe('https://drive.google.com/file/d/file-123/view')
    })
  })

  describe('getFileBuffer', () => {
    it('downloads file content and returns a Buffer', async () => {
      const fakeBuffer = new Uint8Array([4, 5, 6]).buffer
      mockDriveApi.files.get.mockResolvedValue({ data: fakeBuffer })

      const result = await service.getFileBuffer('file-123')

      expect(Buffer.isBuffer(result)).toBe(true)
      expect(result).toEqual(Buffer.from(fakeBuffer))
      expect(mockDriveApi.files.get).toHaveBeenCalledWith(
        { fileId: 'file-123', alt: 'media' },
        { responseType: 'arraybuffer' },
      )
    })
  })
})
