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

vi.mock('googleapis', () => ({
  google: {
    sheets: vi.fn().mockImplementation(function () { return mockSheetsApi }),
    auth: {
      JWT: vi.fn().mockImplementation(function () { return {} }),
    },
  },
}))

import { SheetsService } from '../services/sheets'

describe('SheetsService', () => {
  let service: SheetsService

  beforeEach(() => {
    vi.clearAllMocks()
    service = new SheetsService()
  })

  describe('getRows', () => {
    it('returns rows from spreadsheet values', async () => {
      mockSheetsApi.spreadsheets.values.get.mockResolvedValue({
        data: { values: [['Name', 'Score'], ['Alice', '10']] },
      })

      const rows = await service.getRows('Sheet1')

      expect(rows).toEqual([['Name', 'Score'], ['Alice', '10']])
      expect(mockSheetsApi.spreadsheets.values.get).toHaveBeenCalledWith({
        spreadsheetId: expect.any(String),
        range: 'Sheet1',
      })
    })

    it('returns empty array when no values', async () => {
      mockSheetsApi.spreadsheets.values.get.mockResolvedValue({
        data: { values: undefined },
      })

      const rows = await service.getRows('Sheet1')

      expect(rows).toEqual([])
    })
  })

  describe('getRowByAppId', () => {
    it('returns matching row with index and data', async () => {
      mockSheetsApi.spreadsheets.values.get.mockResolvedValue({
        data: {
          values: [
            ['Name', 'AppId', 'Status'],
            ['Alice', 'app-1', 'active'],
            ['Bob', 'app-2', 'pending'],
          ],
        },
      })

      const result = await service.getRowByAppId('Sheet1', 1, 'app-2')

      expect(result).toEqual({
        index: 3,
        data: { Name: 'Bob', AppId: 'app-2', Status: 'pending' },
      })
    })

    it('returns null when no matching row found', async () => {
      mockSheetsApi.spreadsheets.values.get.mockResolvedValue({
        data: {
          values: [
            ['Name', 'AppId'],
            ['Alice', 'app-1'],
          ],
        },
      })

      const result = await service.getRowByAppId('Sheet1', 1, 'nonexistent')

      expect(result).toBeNull()
    })
  })

  describe('appendRow', () => {
    it('appends values to sheet', async () => {
      mockSheetsApi.spreadsheets.values.append.mockResolvedValue({})

      await service.appendRow('Sheet1', ['Alice', 42, true])

      expect(mockSheetsApi.spreadsheets.values.append).toHaveBeenCalledWith({
        spreadsheetId: expect.any(String),
        range: 'Sheet1',
        valueInputOption: 'USER_ENTERED',
        requestBody: { values: [['Alice', '42', 'true']] },
      })
    })
  })

  describe('updateCell', () => {
    it('updates cell with correct A1 notation', async () => {
      mockSheetsApi.spreadsheets.values.update.mockResolvedValue({})

      await service.updateCell('Sheet1', 2, 3, 'hello')

      expect(mockSheetsApi.spreadsheets.values.update).toHaveBeenCalledWith({
        spreadsheetId: expect.any(String),
        range: 'Sheet1!C2',
        valueInputOption: 'USER_ENTERED',
        requestBody: { values: [['hello']] },
      })
    })

    it('handles column 27 as AA', async () => {
      mockSheetsApi.spreadsheets.values.update.mockResolvedValue({})

      await service.updateCell('Sheet1', 2, 27, 'hello')

      expect(mockSheetsApi.spreadsheets.values.update).toHaveBeenCalledWith({
        spreadsheetId: expect.any(String),
        range: 'Sheet1!AA2',
        valueInputOption: 'USER_ENTERED',
        requestBody: { values: [['hello']] },
      })
    })

    it('handles column 28 as AB', async () => {
      mockSheetsApi.spreadsheets.values.update.mockResolvedValue({})

      await service.updateCell('Sheet1', 2, 28, 'hello')

      expect(mockSheetsApi.spreadsheets.values.update).toHaveBeenCalledWith({
        spreadsheetId: expect.any(String),
        range: 'Sheet1!AB2',
        valueInputOption: 'USER_ENTERED',
        requestBody: { values: [['hello']] },
      })
    })

    it('handles column 52 as AZ', async () => {
      mockSheetsApi.spreadsheets.values.update.mockResolvedValue({})

      await service.updateCell('Sheet1', 2, 52, 'hello')

      expect(mockSheetsApi.spreadsheets.values.update).toHaveBeenCalledWith({
        spreadsheetId: expect.any(String),
        range: 'Sheet1!AZ2',
        valueInputOption: 'USER_ENTERED',
        requestBody: { values: [['hello']] },
      })
    })

    it('handles column 53 as BA', async () => {
      mockSheetsApi.spreadsheets.values.update.mockResolvedValue({})

      await service.updateCell('Sheet1', 2, 53, 'hello')

      expect(mockSheetsApi.spreadsheets.values.update).toHaveBeenCalledWith({
        spreadsheetId: expect.any(String),
        range: 'Sheet1!BA2',
        valueInputOption: 'USER_ENTERED',
        requestBody: { values: [['hello']] },
      })
    })
  })

  describe('getHeaders', () => {
    it('returns first row as headers', async () => {
      mockSheetsApi.spreadsheets.values.get.mockResolvedValue({
        data: { values: [['Name', 'Age', 'City']] },
      })

      const headers = await service.getHeaders('Sheet1')

      expect(headers).toEqual(['Name', 'Age', 'City'])
    })

    it('returns empty array for empty sheet', async () => {
      mockSheetsApi.spreadsheets.values.get.mockResolvedValue({
        data: { values: [] },
      })

      const headers = await service.getHeaders('Sheet1')

      expect(headers).toEqual([])
    })
  })

  describe('findColumnIndex', () => {
    it('returns index of header', async () => {
      mockSheetsApi.spreadsheets.values.get.mockResolvedValue({
        data: { values: [['Name', 'Age', 'City']] },
      })

      const idx = await service.findColumnIndex('Sheet1', 'Age')

      expect(idx).toBe(1)
    })

    it('returns -1 when header not found', async () => {
      mockSheetsApi.spreadsheets.values.get.mockResolvedValue({
        data: { values: [['Name', 'Age']] },
      })

      const idx = await service.findColumnIndex('Sheet1', 'Unknown')

      expect(idx).toBe(-1)
    })
  })

  describe('ensureHeader', () => {
    it('returns existing header index', async () => {
      mockSheetsApi.spreadsheets.values.get.mockResolvedValue({
        data: { values: [['Name', 'Age']] },
      })

      const idx = await service.ensureHeader('Sheet1', 'Age')

      expect(idx).toBe(1)
    })

    it('adds missing header and returns new index', async () => {
      mockSheetsApi.spreadsheets.values.get.mockResolvedValue({
        data: { values: [['Name', 'Age']] },
      })
      mockSheetsApi.spreadsheets.values.update.mockResolvedValue({})

      const idx = await service.ensureHeader('Sheet1', 'City')

      expect(idx).toBe(2)
      expect(mockSheetsApi.spreadsheets.values.update).toHaveBeenCalledWith({
        spreadsheetId: expect.any(String),
        range: 'Sheet1!C1',
        valueInputOption: 'USER_ENTERED',
        requestBody: { values: [['City']] },
      })
    })
  })
})
