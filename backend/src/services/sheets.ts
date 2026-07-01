import { google, sheets_v4 } from 'googleapis'
import { config } from '../config'

function getAuth() {
  return new google.auth.JWT({
    email: config.googleServiceAccountEmail,
    key: config.googleServiceAccountKey.replace(/\\n/g, '\n'),
    scopes: [
      'https://www.googleapis.com/auth/spreadsheets',
      'https://www.googleapis.com/auth/drive',
      'https://www.googleapis.com/auth/documents',
      'https://www.googleapis.com/auth/gmail.send',
    ],
  })
}

function sheetsClient(): sheets_v4.Sheets {
  return google.sheets({ version: 'v4', auth: getAuth() })
}

export class SheetsService {
  async getRows(sheetName: string): Promise<string[][]> {
    const res = await sheetsClient().spreadsheets.values.get({
      spreadsheetId: config.spreadsheetId,
      range: sheetName,
    })
    return res.data.values || []
  }

  async getRowByAppId(sheetName: string, appIdColIndex: number, appId: string) {
    const rows = await this.getRows(sheetName)
    const headers = rows[0]
    for (let i = 1; i < rows.length; i++) {
      if (rows[i][appIdColIndex] === appId) {
        const row: Record<string, string> = {}
        headers.forEach((h, idx) => { row[h] = rows[i][idx] || '' })
        return { index: i + 1, data: row }
      }
    }
    return null
  }

  async appendRow(sheetName: string, values: (string | number | boolean)[]): Promise<void> {
    await sheetsClient().spreadsheets.values.append({
      spreadsheetId: config.spreadsheetId,
      range: sheetName,
      valueInputOption: 'USER_ENTERED',
      requestBody: { values: [values.map(String)] },
    })
  }

  async updateCell(sheetName: string, row: number, col: number, value: string): Promise<void> {
    const colLetter = String.fromCharCode(64 + col)
    await sheetsClient().spreadsheets.values.update({
      spreadsheetId: config.spreadsheetId,
      range: `${sheetName}!${colLetter}${row}`,
      valueInputOption: 'USER_ENTERED',
      requestBody: { values: [[value]] },
    })
  }

  async getHeaders(sheetName: string): Promise<string[]> {
    const rows = await this.getRows(sheetName)
    return rows.length > 0 ? rows[0] : []
  }

  async findColumnIndex(sheetName: string, headerName: string): Promise<number> {
    const headers = await this.getHeaders(sheetName)
    const idx = headers.indexOf(headerName)
    return idx === -1 ? -1 : idx
  }

  async ensureHeader(sheetName: string, headerName: string): Promise<number> {
    const headers = await this.getHeaders(sheetName)
    let idx = headers.indexOf(headerName)
    if (idx === -1) {
      idx = headers.length
      await this.updateCell(sheetName, 1, idx + 1, headerName)
    }
    return idx
  }
}
