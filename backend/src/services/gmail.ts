import { google } from 'googleapis'
import { config } from '../config'

function gmailClient() {
  const auth = new google.auth.JWT({
    email: config.googleServiceAccountEmail,
    key: config.googleServiceAccountKey.replace(/\\n/g, '\n'),
    scopes: ['https://www.googleapis.com/auth/gmail.send'],
    subject: config.gmailUser,
  })
  return google.gmail({ version: 'v1', auth })
}

export class GmailService {
  async sendEmailWithAttachment(opts: {
    to: string
    subject: string
    body: string
    attachment: { filename: string; content: Buffer; mimeType: string }
  }): Promise<void> {
    const boundary = 'boundary_' + Date.now()
    const nl = '\r\n'

    const message = [
      `From: ${config.gmailUser}`,
      `To: ${opts.to}`,
      `Subject: =?UTF-8?B?${Buffer.from(opts.subject).toString('base64')}?=`,
      'MIME-Version: 1.0',
      `Content-Type: multipart/mixed; boundary="${boundary}"`,
      '',
      `--${boundary}`,
      'Content-Type: text/plain; charset=UTF-8',
      '',
      opts.body,
      '',
      `--${boundary}`,
      `Content-Type: ${opts.attachment.mimeType}; name="${opts.attachment.filename}"`,
      'Content-Disposition: attachment',
      'Content-Transfer-Encoding: base64',
      '',
      opts.attachment.content.toString('base64'),
      `--${boundary}--`,
    ].join(nl)

    const encodedMessage = Buffer.from(message).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')

    await gmailClient().users.messages.send({
      userId: 'me',
      requestBody: { raw: encodedMessage },
    })
  }
}
