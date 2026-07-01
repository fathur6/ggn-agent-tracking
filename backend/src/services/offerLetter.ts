import { config } from '../config'
import { SheetsService } from './sheets'
import { DriveService } from './drive'
import { DocsService } from './docs'
import { GmailService } from './gmail'
import { generateApplicationId } from '../utils/appId'
import { AppError } from '../utils/errors'

interface OfferLetterInput {
  fullName: string
  email: string
  passport: string
  structure: string
  programme: string
  agentId: string
  agentName: string
  formId: string
}

interface OfferLetterResult {
  applicationId: string
  pdfUrl: string
}

export async function generateAndSendOffer(input: OfferLetterInput): Promise<OfferLetterResult> {
  const sheets = new SheetsService()
  const drive = new DriveService()
  const docs = new DocsService()
  const gmail = new GmailService()

  const appId = await generateApplicationId(sheets)

  const now = new Date()
  const formattedDate = now.toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })

  const progLower = input.programme.toLowerCase()
  let programmeLevel = 'M'
  if (progLower.includes('doctor') || progLower.includes('ph.d') || progLower.includes('phd')) {
    programmeLevel = 'PHD'
  }

  const docName = `Conditional Offer - ${input.fullName}`
  const docId = await drive.copyTemplate(config.offerTemplateDocId, docName, config.offerOutputFolderId)

  await docs.replacePlaceholders(docId, {
    '{{Reference}}': appId,
    '{{Date}}': formattedDate,
    '{{Name}}': input.fullName,
    '{{Passport}}': input.passport,
    '{{Email}}': input.email,
    '{{Programme}}': input.programme,
    '{{Structure}}': input.structure,
  })

  const pdfBuffer = await drive.exportPdf(docId)
  const pdfFilename = `UNISZA Conditional Offer - ${input.fullName}.pdf`

  await drive.deleteFile(docId)

  const pdfUrl = `https://drive.google.com/file/d/${docId}/view`

  await sheets.ensureHeader('Leads', 'ProgrammeLevel')
  await sheets.ensureHeader('Leads', 'Status')
  await sheets.ensureHeader('Leads', 'OfferPDF')
  await sheets.ensureHeader('Leads', 'ApplicationID')

  const rowValues = [
    appId,
    new Date().toISOString(),
    input.fullName,
    input.email,
    input.passport,
    '',
    input.structure,
    input.programme,
    programmeLevel,
    '',
    input.agentId,
    input.agentName,
    input.formId,
    'Offer Sent',
    pdfUrl,
    '',
  ]

  await sheets.appendRow('Leads', rowValues)

  const emailBody = [
    `Dear ${input.fullName},`,
    '',
    'Thank you for your interest in postgraduate study at Universiti Sultan Zainal Abidin.',
    '',
    'Please find attached your Conditional Offer Letter.',
    '',
    `Application ID: ${appId}`,
    '',
    'You are required to submit your formal application through the official UniSZA application portal: https://siswa.unisza.edu.my/pascaonline/',
    '',
    'Best regards,',
    '',
    'Graduate School',
    'Universiti Sultan Zainal Abidin',
  ].join('\n')

  await gmail.sendEmailWithAttachment({
    to: input.email,
    subject: 'Conditional Offer - Universiti Sultan Zainal Abidin',
    body: emailBody,
    attachment: {
      filename: pdfFilename,
      content: pdfBuffer,
      mimeType: 'application/pdf',
    },
  })

  return { applicationId: appId, pdfUrl }
}
