import { describe, it, expect, vi, beforeEach } from 'vitest'
import { generateApplicationId } from '../utils/appId'

const mockSheetsApi = {
  spreadsheets: {
    values: {
      get: vi.fn(),
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

describe('generateApplicationId', () => {
  let sheets: SheetsService

  beforeEach(() => {
    vi.clearAllMocks()
    sheets = new SheetsService()
  })

  it('returns YYYYMMDD-001 when no ApplicationID header exists', async () => {
    mockSheetsApi.spreadsheets.values.get.mockResolvedValue({
      data: { values: [['Name', 'Email']] },
    })
    mockSheetsApi.spreadsheets.values.update.mockResolvedValue({})

    const id = await generateApplicationId(sheets)

    const today = new Date()
    const prefix = [
      today.getFullYear(),
      String(today.getMonth() + 1).padStart(2, '0'),
      String(today.getDate()).padStart(2, '0'),
    ].join('')

    expect(id).toBe(`${prefix}-001`)
    expect(mockSheetsApi.spreadsheets.values.update).toHaveBeenCalled()
  })

  it('returns YYYYMMDD-001 when ApplicationID header exists but no rows have IDs for today', async () => {
    mockSheetsApi.spreadsheets.values.get.mockResolvedValue({
      data: {
        values: [
          ['Name', 'Email', 'ApplicationID'],
          ['Alice', 'a@b.com', ''],
        ],
      },
    })

    const id = await generateApplicationId(sheets)

    const today = new Date()
    const prefix = [
      today.getFullYear(),
      String(today.getMonth() + 1).padStart(2, '0'),
      String(today.getDate()).padStart(2, '0'),
    ].join('')

    expect(id).toBe(`${prefix}-001`)
  })

  it('increments count when previous IDs exist for today', async () => {
    const today = new Date()
    const prefix = [
      today.getFullYear(),
      String(today.getMonth() + 1).padStart(2, '0'),
      String(today.getDate()).padStart(2, '0'),
    ].join('')

    mockSheetsApi.spreadsheets.values.get.mockResolvedValue({
      data: {
        values: [
          ['Name', 'Email', 'ApplicationID'],
          ['Alice', 'a@b.com', `${prefix}-001`],
          ['Bob', 'b@b.com', `${prefix}-002`],
        ],
      },
    })

    const id = await generateApplicationId(sheets)

    expect(id).toBe(`${prefix}-003`)
  })

  it('ignores IDs from other dates when counting', async () => {
    const today = new Date()
    const prefix = [
      today.getFullYear(),
      String(today.getMonth() + 1).padStart(2, '0'),
      String(today.getDate()).padStart(2, '0'),
    ].join('')

    mockSheetsApi.spreadsheets.values.get.mockResolvedValue({
      data: {
        values: [
          ['Name', 'Email', 'ApplicationID'],
          ['Alice', 'a@b.com', '20250615-005'],
          ['Bob', 'b@b.com', `${prefix}-001`],
        ],
      },
    })

    const id = await generateApplicationId(sheets)

    expect(id).toBe(`${prefix}-002`)
  })

  it('handles empty sheet data gracefully', async () => {
    mockSheetsApi.spreadsheets.values.get.mockResolvedValue({
      data: { values: [] },
    })
    mockSheetsApi.spreadsheets.values.update.mockResolvedValue({})

    const id = await generateApplicationId(sheets)

    const today = new Date()
    const prefix = [
      today.getFullYear(),
      String(today.getMonth() + 1).padStart(2, '0'),
      String(today.getDate()).padStart(2, '0'),
    ].join('')

    expect(id).toBe(`${prefix}-001`)
  })
})
