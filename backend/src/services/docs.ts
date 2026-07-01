import { google } from 'googleapis'
import { config } from '../config'

function docsClient() {
  const auth = new google.auth.JWT({
    email: config.googleServiceAccountEmail,
    key: config.googleServiceAccountKey.replace(/\\n/g, '\n'),
    scopes: ['https://www.googleapis.com/auth/documents'],
  })
  return google.docs({ version: 'v1', auth })
}

export class DocsService {
  async replacePlaceholders(docId: string, replacements: Record<string, string>): Promise<void> {
    const requests = Object.entries(replacements).map(([key, value]) => ({
      replaceAllText: {
        containsText: { text: key, matchCase: true },
        replaceText: value,
      },
    }))

    await docsClient().documents.batchUpdate({
      documentId: docId,
      requestBody: { requests },
    })
  }
}
