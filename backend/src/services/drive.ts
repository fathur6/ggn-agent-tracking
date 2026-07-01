import { google } from 'googleapis'
import { config } from '../config'

function driveClient() {
  const auth = new google.auth.JWT({
    email: config.googleServiceAccountEmail,
    key: config.googleServiceAccountKey.replace(/\\n/g, '\n'),
    scopes: ['https://www.googleapis.com/auth/drive'],
  })
  return google.drive({ version: 'v3', auth })
}

export class DriveService {
  async copyTemplate(templateId: string, name: string, folderId: string): Promise<string> {
    const res = await driveClient().files.copy({
      fileId: templateId,
      requestBody: {
        name,
        parents: [folderId],
      },
    })
    return res.data.id!
  }

  async exportPdf(fileId: string): Promise<Buffer> {
    const res = await driveClient().files.export(
      { fileId, mimeType: 'application/pdf' },
      { responseType: 'arraybuffer' },
    )
    return Buffer.from(res.data as ArrayBuffer)
  }

  async deleteFile(fileId: string): Promise<void> {
    await driveClient().files.delete({ fileId })
  }

  async getFileUrl(fileId: string): Promise<string> {
    return `https://drive.google.com/file/d/${fileId}/view`
  }

  async getFileBuffer(fileId: string): Promise<Buffer> {
    const res = await driveClient().files.get(
      { fileId, alt: 'media' },
      { responseType: 'arraybuffer' },
    )
    return Buffer.from(res.data as ArrayBuffer)
  }
}
