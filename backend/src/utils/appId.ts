import { SheetsService } from '../services/sheets'

export async function generateApplicationId(sheets: SheetsService): Promise<string> {
  const now = new Date()
  const datePrefix = [
    now.getFullYear(),
    String(now.getMonth() + 1).padStart(2, '0'),
    String(now.getDate()).padStart(2, '0'),
  ].join('')

  const rows = await sheets.getRows('Leads')
  const headers = rows[0]
  const appIdCol = headers ? headers.indexOf('ApplicationID') : -1

  if (appIdCol === -1) {
    await sheets.ensureHeader('Leads', 'ApplicationID')
    return `${datePrefix}-001`
  }

  let dailyCount = 0
  for (let i = 1; i < rows.length; i++) {
    const existingId = rows[i][appIdCol]
    if (existingId && existingId.startsWith(datePrefix)) {
      dailyCount++
    }
  }

  dailyCount++
  const number = String(dailyCount).padStart(3, '0')
  return `${datePrefix}-${number}`
}
