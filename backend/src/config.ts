import dotenv from 'dotenv'
dotenv.config()

export const config = {
  port: parseInt(process.env.PORT || '8080', 10),
  nodeEnv: process.env.NODE_ENV || 'development',
  googleClientId: process.env.GOOGLE_CLIENT_ID || '',
  jwtSecret: process.env.JWT_SECRET || 'change-me-in-production',
  spreadsheetId: process.env.SPREADSHEET_ID || '',
  offerTemplateDocId: process.env.OFFER_TEMPLATE_DOC_ID || '',
  offerOutputFolderId: process.env.OFFER_OUTPUT_FOLDER_ID || '',
  gmailUser: process.env.GMAIL_USER || '',
  googleServiceAccountEmail: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL || '',
  googleServiceAccountKey: process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY || '',
  frontendUrl: process.env.FRONTEND_URL || 'http://localhost:3000',
} as const
