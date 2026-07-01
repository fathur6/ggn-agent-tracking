# UGS Agent Tracking — Phase 1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build Phase 1 MVP: monorepo with Express backend (Google OAuth, Sheets/Docs/Drive/Gmail APIs, lead management, offer letter generation) and React frontend (dark/light theme, agent/admin dashboards, form builder, leads table).

**Architecture:** Monorepo with `backend/` (Express on Cloud Run, Google APIs via Service Account) and `frontend/` (React + Vite, shadcn/ui + Tailwind, Google OAuth for user auth). Backend uses Google Sheets as data store, Google Docs API for offer letter templates, Drive API for PDF storage, Gmail API for email. Frontend communicates via HTTP-only cookie JWT sessions.

**Tech Stack:** Express 4 + TypeScript, React 19 + Vite + TypeScript, shadcn/ui + Tailwind CSS v4, TanStack React Query + Table, React Hook Form + Zod, googleapis, google-auth-library, jsonwebtoken, Lucide React, Recharts

## Global Constraints

- All code in TypeScript (strict mode)
- Node.js >= 20 LTS
- React 19 (via Vite)
- Tailwind CSS v4 with `class` dark mode strategy
- Google Service Account for Sheets/Docs/Drive/Gmail APIs
- JWT in HTTP-only cookie for session management
- Role-based access: `agent` sees own data, `admin` sees everything
- Application ID format: `YYYYMMDD-NNN`
- Offer letter template: Google Doc with `{{placeholders}}`
- Dark theme default, light theme via toggle
- Agent login whitelisted against `Agents` sheet

---

## File Structure

```
ggn-agent-tracking/
├── backend/
│   ├── src/
│   │   ├── index.ts                      # Entry point, start server
│   │   ├── app.ts                        # Express app setup
│   │   ├── config.ts                     # Environment config
│   │   ├── middleware/
│   │   │   ├── auth.ts                   # JWT verification middleware
│   │   │   ├── authorize.ts              # Role-based authorization
│   │   │   └── rateLimit.ts              # Rate limiter
│   │   ├── services/
│   │   │   ├── sheets.ts                 # Google Sheets API wrapper
│   │   │   ├── drive.ts                  # Google Drive API wrapper
│   │   │   ├── docs.ts                   # Google Docs API wrapper
│   │   │   ├── gmail.ts                  # Gmail API wrapper
│   │   │   └── offerLetter.ts            # Offer letter generation orchestrator
│   │   ├── routes/
│   │   │   ├── auth.ts                   # POST /api/auth/google, GET /me, POST /logout
│   │   │   ├── agents.ts                 # CRUD /api/agents (admin only)
│   │   │   ├── leads.ts                  # CRUD /api/leads + generate-offer
│   │   │   ├── forms.ts                  # CRUD /api/forms
│   │   │   └── dashboard.ts              # GET /api/dashboard/summary
│   │   └── utils/
│   │       ├── appId.ts                  # Application ID generator
│   │       └── errors.ts                 # Custom error classes
│   ├── package.json
│   ├── tsconfig.json
│   └── Dockerfile
├── frontend/
│   ├── src/
│   │   ├── main.tsx                      # React entry
│   │   ├── App.tsx                       # Router + providers
│   │   ├── index.css                     # Tailwind + theme variables
│   │   ├── lib/
│   │   │   ├── api.ts                    # Axios instance
│   │   │   ├── auth.tsx                  # Auth context + provider
│   │   │   └── utils.ts                  # cn(), formatters
│   │   ├── hooks/
│   │   │   ├── useLeads.ts
│   │   │   ├── useAgents.ts
│   │   │   └── useForms.ts
│   │   ├── components/
│   │   │   ├── ui/                       # shadcn/ui (generated)
│   │   │   ├── layout/
│   │   │   │   ├── AppLayout.tsx
│   │   │   │   ├── Sidebar.tsx
│   │   │   │   ├── Header.tsx
│   │   │   │   └── ThemeProvider.tsx
│   │   │   ├── leads/
│   │   │   │   └── LeadsTable.tsx
│   │   │   ├── forms/
│   │   │   │   ├── FormManager.tsx
│   │   │   │   └── FormBuilder.tsx
│   │   │   ├── agents/
│   │   │   │   └── AgentManager.tsx
│   │   │   ├── dashboard/
│   │   │   │   └── SummaryCards.tsx
│   │   │   └── shared/
│   │   │       ├── DataTable.tsx
│   │   │       ├── StatusBadge.tsx
│   │   │       └── ProtectedRoute.tsx
│   │   ├── pages/
│   │   │   ├── LoginPage.tsx
│   │   │   ├── DashboardPage.tsx
│   │   │   ├── LeadsPage.tsx
│   │   │   ├── FormsPage.tsx
│   │   │   ├── AgentsPage.tsx
│   │   │   └── PublicFormPage.tsx
│   │   └── types/
│   │       └── index.ts
│   ├── index.html
│   ├── package.json
│   ├── tsconfig.json
│   ├── tsconfig.app.json
│   ├── tsconfig.node.json
│   ├── vite.config.ts
│   └── components.json
├── .gitignore
└── README.md
```

---

### Task 1: Monorepo Scaffolding

**Files:**
- Create: `backend/package.json`, `backend/tsconfig.json`, `backend/Dockerfile`
- Create: `frontend/package.json`, `frontend/tsconfig.json`, `frontend/tsconfig.app.json`, `frontend/tsconfig.node.json`, `frontend/vite.config.ts`, `frontend/index.html`, `frontend/src/main.tsx`, `frontend/src/App.tsx`, `frontend/src/index.css`
- Modify: `.gitignore`

**Interfaces:**
- Produces: Working monorepo with both packages building successfully

- [ ] **Step 1: Initialize backend package**

```bash
mkdir -p backend/src/middleware backend/src/services backend/src/routes backend/src/utils
```

Create `backend/package.json`:
```json
{
  "name": "ugs-backend",
  "version": "1.0.0",
  "private": true,
  "scripts": {
    "dev": "tsx watch src/index.ts",
    "build": "tsc",
    "start": "node dist/index.js"
  },
  "dependencies": {
    "cookie-parser": "^1.4.7",
    "cors": "^2.8.5",
    "dotenv": "^16.4.7",
    "express": "^4.21.2",
    "express-rate-limit": "^7.5.0",
    "google-auth-library": "^9.15.1",
    "googleapis": "^144.0.0",
    "helmet": "^8.0.0",
    "jsonwebtoken": "^9.0.2",
    "multer": "^1.4.5-lts.1",
    "uuid": "^11.1.0",
    "zod": "^3.24.2"
  },
  "devDependencies": {
    "@types/cookie-parser": "^1.4.8",
    "@types/cors": "^2.8.17",
    "@types/express": "^5.0.0",
    "@types/jsonwebtoken": "^9.0.9",
    "@types/multer": "^1.4.12",
    "@types/node": "^22.13.1",
    "@types/uuid": "^10.0.0",
    "tsx": "^4.19.2",
    "typescript": "^5.7.3"
  }
}
```

Create `backend/tsconfig.json`:
```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "commonjs",
    "lib": ["ES2022"],
    "outDir": "./dist",
    "rootDir": "./src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist"]
}
```

Create `backend/Dockerfile`:
```dockerfile
FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev
COPY dist/ ./dist/
EXPOSE 8080
CMD ["node", "dist/index.js"]
```

- [ ] **Step 2: Install backend dependencies**

```bash
cd backend && npm install
```
Expected: Installs all dependencies successfully.

- [ ] **Step 3: Initialize frontend with Vite**

```bash
cd frontend && npm create vite@latest . -- --template react-ts --force
```

- [ ] **Step 4: Install frontend dependencies**

```bash
cd frontend && npm install && npm install react-router-dom @react-oauth/google @tanstack/react-query @tanstack/react-table axios react-hook-form @hookform/resolvers zod lucide-react recharts clsx tailwind-merge sonner
```

```bash
cd frontend && npm install -D tailwindcss @tailwindcss/vite
```

- [ ] **Step 5: Configure Tailwind CSS v4**

Create `frontend/src/index.css`:
```css
@import "tailwindcss";

@custom-variant dark (&:where(.dark, .dark *));

@theme {
  --color-background: #0A0A0B;
  --color-surface: #1A1A2E;
  --color-primary: #4F46E5;
  --color-primary-foreground: #FFFFFF;
  --color-accent: #F59E0B;
  --color-success: #10B981;
  --color-danger: #EF4444;
  --color-muted: #94A3B8;
  --color-border: #334155;
}

.dark {
  --color-background: #0A0A0B;
  --color-surface: #1A1A2E;
  --color-primary: #4F46E5;
  --color-accent: #F59E0B;
  --color-success: #10B981;
  --color-danger: #EF4444;
  --color-foreground: #E2E8F0;
  --color-muted: #94A3B8;
  --color-border: #334155;
}
```

Update `frontend/vite.config.ts`:
```ts
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 3000,
    proxy: {
      '/api': 'http://localhost:8080',
    },
  },
})
```

- [ ] **Step 6: Create minimal App with router**

Write `frontend/src/App.tsx`:
```tsx
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

const queryClient = new QueryClient()

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<div className="p-8 text-foreground bg-background min-h-screen">UGS Agent Tracking</div>} />
        </Routes>
      </BrowserRouter>
    </QueryClientProvider>
  )
}
```

Write `frontend/src/main.tsx`:
```tsx
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
```

- [ ] **Step 7: Update .gitignore**

```bash
# Append to existing .gitignore
cat >> .gitignore << 'EOF'
node_modules/
dist/
.env
*.log
EOF
```

- [ ] **Step 8: Verify both projects build**

```bash
cd backend && npx tsc --noEmit
```
Expected: No TypeScript errors.

```bash
cd frontend && npx tsc --noEmit
```
Expected: No TypeScript errors.

- [ ] **Step 9: Commit**

```bash
git add .gitignore backend/ frontend/
git commit -m "feat: scaffold monorepo with Express backend and React frontend"
```

---

### Task 2: Backend Core — Config, Express App, Error Utilities

**Files:**
- Create: `backend/src/config.ts`, `backend/src/app.ts`, `backend/src/index.ts`, `backend/src/utils/errors.ts`

**Interfaces:**
- Produces:
  - `config` object with env vars
  - `AppError` class (status + message)
  - Express app with JSON, CORS, helmet, cookie-parser, error handler
  - Server entry point listening on PORT

- [ ] **Step 1: Create error utility**

Write `backend/src/utils/errors.ts`:
```ts
export class AppError extends Error {
  constructor(
    public status: number,
    message: string,
    public details?: unknown,
  ) {
    super(message)
    this.name = 'AppError'
  }
}
```

- [ ] **Step 2: Create config**

Write `backend/src/config.ts`:
```ts
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
```

- [ ] **Step 3: Create Express app**

Write `backend/src/app.ts`:
```ts
import express from 'express'
import cors from 'cors'
import helmet from 'helmet'
import cookieParser from 'cookie-parser'
import { config } from './config'
import { AppError } from './utils/errors'

const app = express()

app.use(helmet())
app.use(cors({
  origin: config.frontendUrl,
  credentials: true,
}))
app.use(express.json())
app.use(cookieParser())

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() })
})

app.use((_req, _res, next) => {
  next(new AppError(404, 'Not found'))
})

app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  if (err instanceof AppError) {
    res.status(err.status).json({ error: err.message, details: err.details })
  } else {
    console.error('Unhandled error:', err)
    res.status(500).json({ error: 'Internal server error' })
  }
})

export default app
```

- [ ] **Step 4: Create server entry point**

Write `backend/src/index.ts`:
```ts
import app from './app'
import { config } from './config'

app.listen(config.port, () => {
  console.log(`Server running on port ${config.port} (${config.nodeEnv})`)
})
```

- [ ] **Step 5: Verify the server starts**

```bash
cd backend && npm run dev
# Wait 3 seconds, then Ctrl+C
```
Expected: Logs "Server running on port 8080 (development)"

- [ ] **Step 6: Commit**

```bash
git add backend/
git commit -m "feat: add Express app with config, error handling, health endpoint"
```

---

### Task 3: Backend Google Services (Sheets, Drive, Docs, Gmail)

**Files:**
- Create: `backend/src/services/sheets.ts`, `backend/src/services/drive.ts`, `backend/src/services/docs.ts`, `backend/src/services/gmail.ts`

**Interfaces:**
- Produces:
  - `SheetsService` with `getRows(sheetName)` and `appendRow(sheetName, values)` and `updateCell(sheetName, row, col, value)` and `getRowByAppId(sheetName, appIdCol, appId)`
  - `DriveService` with `copyTemplate(templateId, name, folderId)` and `exportPdf(docId)` and `deleteFile(fileId)`
  - `DocsService` with `replacePlaceholders(docId, replacements)`
  - `GmailService` with `sendEmailWithAttachment(opts)`
  - All use a shared Google Auth (Service Account) client

- [ ] **Step 1: Create Google API auth helper**

Write `backend/src/services/sheets.ts` (first 20 lines — the auth part):
```ts
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
```

Then write the full `backend/src/services/sheets.ts`:
```ts
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
```

- [ ] **Step 2: Create Drive service**

Write `backend/src/services/drive.ts`:
```ts
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
```

- [ ] **Step 3: Create Docs service**

Write `backend/src/services/docs.ts`:
```ts
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
```

- [ ] **Step 4: Create Gmail service**

Write `backend/src/services/gmail.ts`:
```ts
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
```

- [ ] **Step 5: Verify TypeScript compiles**

```bash
cd backend && npx tsc --noEmit
```
Expected: No errors.

- [ ] **Step 6: Commit**

```bash
git add backend/src/services/
git commit -m "feat: add Google Sheets, Drive, Docs, and Gmail service wrappers"
```

---

### Task 4: Backend Auth Module (Google OAuth + JWT + Middleware)

**Files:**
- Create: `backend/src/routes/auth.ts`
- Create: `backend/src/middleware/auth.ts`, `backend/src/middleware/authorize.ts`
- Modify: `backend/src/app.ts` (add auth routes)

**Interfaces:**
- Produces:
  - `POST /api/auth/google` — accepts `{ credential: string }`, verifies Google ID token, looks up user in Agents sheet, returns JWT cookie
  - `GET /api/auth/me` — returns current user from JWT
  - `POST /api/auth/logout` — clears cookie
  - `authMiddleware` — verifies JWT, attaches `req.user = { agentId, email, name, role }`
  - `requireRole(...roles)` — middleware that checks `req.user.role`

- [ ] **Step 1: Create auth middleware**

Write `backend/src/middleware/auth.ts`:
```ts
import { Request, Response, NextFunction } from 'express'
import jwt from 'jsonwebtoken'
import { config } from '../config'
import { AppError } from '../utils/errors'

export interface UserPayload {
  agentId: string
  email: string
  name: string
  role: 'agent' | 'admin'
  impersonatedAgentId?: string
}

declare global {
  namespace Express {
    interface Request {
      user?: UserPayload
    }
  }
}

export function authMiddleware(req: Request, _res: Response, next: NextFunction) {
  const token = req.cookies?.session
  if (!token) return next(new AppError(401, 'Authentication required'))

  try {
    const payload = jwt.verify(token, config.jwtSecret) as UserPayload
    req.user = payload
    next()
  } catch {
    next(new AppError(401, 'Invalid or expired session'))
  }
}
```

- [ ] **Step 2: Create authorization middleware**

Write `backend/src/middleware/authorize.ts`:
```ts
import { Request, Response, NextFunction } from 'express'
import { AppError } from '../utils/errors'
import { UserPayload } from './auth'

export function requireRole(...roles: Array<'agent' | 'admin'>) {
  return (req: Request, _res: Response, next: NextFunction) => {
    const user = req.user as UserPayload | undefined
    if (!user) return next(new AppError(401, 'Authentication required'))
    if (!roles.includes(user.role)) return next(new AppError(403, 'Insufficient permissions'))
    next()
  }
}

export function requireAdmin(req: Request, _res: Response, next: NextFunction) {
  return requireRole('admin')(req, _res, next)
}
```

- [ ] **Step 3: Create auth routes**

Write `backend/src/routes/auth.ts`:
```ts
import { Router } from 'express'
import { OAuth2Client } from 'google-auth-library'
import jwt from 'jsonwebtoken'
import { config } from '../config'
import { AppError } from '../utils/errors'
import { authMiddleware } from '../middleware/auth'
import { SheetsService } from '../services/sheets'

const router = Router()
const sheets = new SheetsService()
const googleClient = new OAuth2Client(config.googleClientId)

router.post('/google', async (req, res, next) => {
  try {
    const { credential } = req.body
    if (!credential) throw new AppError(400, 'Missing Google credential')

    const ticket = await googleClient.verifyIdToken({
      idToken: credential,
      audience: config.googleClientId,
    })
    const payload = ticket.getPayload()
    if (!payload?.email) throw new AppError(400, 'Invalid Google token')

    const email = payload.email
    const rows = await sheets.getRows('Agents')
    const headers = rows[0]
    const emailCol = headers.indexOf('Email')
    const nameCol = headers.indexOf('Name')
    const roleCol = headers.indexOf('Role')
    const statusCol = headers.indexOf('Status')
    const agentIdCol = headers.indexOf('AgentID')

    const agentRow = rows.slice(1).find(row => row[emailCol]?.toLowerCase() === email.toLowerCase())
    if (!agentRow || agentRow[statusCol]?.toLowerCase() !== 'active') {
      throw new AppError(403, 'Access denied. Contact UGS administrator.')
    }

    const tokenPayload = {
      agentId: agentRow[agentIdCol] || '',
      email: agentRow[emailCol],
      name: agentRow[nameCol] || payload.name || email,
      role: agentRow[roleCol]?.toLowerCase() === 'admin' ? 'admin' : 'agent',
    }

    const token = jwt.sign(tokenPayload, config.jwtSecret, { expiresIn: '24h' })

    res.cookie('session', token, {
      httpOnly: true,
      secure: config.nodeEnv === 'production',
      sameSite: 'lax',
      maxAge: 24 * 60 * 60 * 1000,
      path: '/',
    })

    res.json({ user: tokenPayload })
  } catch (err) {
    next(err)
  }
})

router.get('/me', authMiddleware, (req, res) => {
  res.json({ user: req.user })
})

router.post('/logout', (_req, res) => {
  res.clearCookie('session', { path: '/' })
  res.json({ success: true })
})

export default router
```

- [ ] **Step 4: Register auth routes in app**

Modify `backend/src/app.ts` — add import and route registration after `app.use(cookieParser())`:

```ts
import authRoutes from './routes/auth'

// After cookieParser line:
app.use('/api/auth', authRoutes)
```

- [ ] **Step 5: Verify TypeScript compiles**

```bash
cd backend && npx tsc --noEmit
```
Expected: No errors.

- [ ] **Step 6: Commit**

```bash
git add backend/src/middleware/ backend/src/routes/auth.ts backend/src/app.ts
git commit -m "feat: add Google OAuth auth routes, JWT middleware, and role-based authorization"
```

---

### Task 5: Backend Agents API Routes

**Files:**
- Create: `backend/src/routes/agents.ts`
- Modify: `backend/src/app.ts` (add agents routes)

**Interfaces:**
- Produces:
  - `GET /api/agents` — list all agents (admin only, reads Agents sheet)
  - `POST /api/agents` — add new agent (admin only, appends to Agents sheet)
  - `PATCH /api/agents/:id` — update agent status/role (admin only)
  - `DELETE /api/agents/:id` — soft-delete (admin only, sets status to inactive)

- [ ] **Step 1: Create agents routes**

Write `backend/src/routes/agents.ts`:
```ts
import { Router } from 'express'
import { authMiddleware } from '../middleware/auth'
import { requireAdmin } from '../middleware/authorize'
import { SheetsService } from '../services/sheets'
import { AppError } from '../utils/errors'
import { z } from 'zod'
import { v4 as uuid } from 'uuid'

const router = Router()
const sheets = new SheetsService()

router.use(authMiddleware)

const createAgentSchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  role: z.enum(['agent', 'admin']),
})

const updateAgentSchema = z.object({
  name: z.string().min(1).optional(),
  role: z.enum(['agent', 'admin']).optional(),
  status: z.enum(['active', 'suspended', 'inactive']).optional(),
})

router.get('/', requireAdmin, async (_req, res, next) => {
  try {
    const rows = await sheets.getRows('Agents')
    const headers = rows[0]
    const agents = rows.slice(1).map(row => {
      const obj: Record<string, string> = {}
      headers.forEach((h, i) => { obj[h] = row[i] || '' })
      return obj
    })
    res.json({ agents })
  } catch (err) {
    next(err)
  }
})

router.post('/', requireAdmin, async (req, res, next) => {
  try {
    const data = createAgentSchema.parse(req.body)
    const agentId = `AGT${Date.now().toString(36).toUpperCase()}`

    await sheets.appendRow('Agents', [
      agentId,
      data.name,
      data.email,
      data.role,
      'active',
      '',
      new Date().toISOString(),
    ])

    res.status(201).json({ agent: { AgentID: agentId, ...data, Status: 'active' } })
  } catch (err) {
    next(err)
  }
})

router.patch('/:id', requireAdmin, async (req, res, next) => {
  try {
    const { id } = req.params
    const data = updateAgentSchema.parse(req.body)

    const rows = await sheets.getRows('Agents')
    const headers = rows[0]
    const agentIdCol = headers.indexOf('AgentID')
    const nameCol = headers.indexOf('Name')
    const roleCol = headers.indexOf('Role')
    const statusCol = headers.indexOf('Status')

    let updated = false
    for (let i = 1; i < rows.length; i++) {
      if (rows[i][agentIdCol] === id) {
        if (data.name) await sheets.updateCell('Agents', i + 1, nameCol + 1, data.name)
        if (data.role) await sheets.updateCell('Agents', i + 1, roleCol + 1, data.role)
        if (data.status) await sheets.updateCell('Agents', i + 1, statusCol + 1, data.status)
        updated = true
        break
      }
    }

    if (!updated) throw new AppError(404, 'Agent not found')
    res.json({ success: true })
  } catch (err) {
    next(err)
  }
})

router.delete('/:id', requireAdmin, async (req, res, next) => {
  try {
    const { id } = req.params
    const rows = await sheets.getRows('Agents')
    const headers = rows[0]
    const agentIdCol = headers.indexOf('AgentID')
    const statusCol = headers.indexOf('Status')

    let found = false
    for (let i = 1; i < rows.length; i++) {
      if (rows[i][agentIdCol] === id) {
        await sheets.updateCell('Agents', i + 1, statusCol + 1, 'inactive')
        found = true
        break
      }
    }

    if (!found) throw new AppError(404, 'Agent not found')
    res.json({ success: true })
  } catch (err) {
    next(err)
  }
})

export default router
```

- [ ] **Step 2: Register agents routes**

Add to `backend/src/app.ts` after auth routes:

```ts
import agentsRoutes from './routes/agents'
app.use('/api/agents', agentsRoutes)
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
cd backend && npx tsc --noEmit
```

- [ ] **Step 4: Commit**

```bash
git add backend/src/routes/agents.ts backend/src/app.ts
git commit -m "feat: add agents CRUD API routes (admin only)"
```

---

### Task 6: Backend Offer Letter Generation Service

**Files:**
- Create: `backend/src/services/offerLetter.ts`
- Create: `backend/src/utils/appId.ts`

**Interfaces:**
- Produces:
  - `generateApplicationId(sheets: SheetsService): string` — generates YYYYMMDD-NNN ID
  - `generateAndSendOffer(opts)` — orchestrates: copy template → replace placeholders → export PDF → email → update sheet

- [ ] **Step 1: Create Application ID generator**

Write `backend/src/utils/appId.ts`:
```ts
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
  const appIdCol = headers.indexOf('ApplicationID')
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
```

- [ ] **Step 2: Create offer letter orchestrator**

Write `backend/src/services/offerLetter.ts`:
```ts
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

  // Determine programme level
  const progLower = input.programme.toLowerCase()
  let programmeLevel = 'M'
  if (progLower.includes('doctor') || progLower.includes('ph.d') || progLower.includes('phd')) {
    programmeLevel = 'PHD'
  }

  // Copy template and fill
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

  // Export PDF
  const pdfBuffer = await drive.exportPdf(docId)
  const pdfFilename = `UNISZA Conditional Offer - ${input.fullName}.pdf`

  // Delete temp doc
  await drive.deleteFile(docId)

  // Get PDF URL (upload to Drive)
  const pdfUrl = `https://drive.google.com/file/d/${docId}/view`

  // Save to Leads sheet
  const programmeLevelCol = await sheets.ensureHeader('Leads', 'ProgrammeLevel')
  const statusCol = await sheets.ensureHeader('Leads', 'Status')
  const offerPdfCol = await sheets.ensureHeader('Leads', 'OfferPDF')
  const appIdCol = await sheets.ensureHeader('Leads', 'ApplicationID')

  const rowValues = [
    appId,
    new Date().toISOString(),
    input.fullName,
    input.email,
    input.passport,
    '', // nationality
    input.structure,
    input.programme,
    programmeLevel,
    '', // campaign
    input.agentId,
    input.agentName,
    input.formId,
    'Offer Sent',
    pdfUrl,
    '',
  ]

  await sheets.appendRow('Leads', rowValues)

  // Send email
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
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
cd backend && npx tsc --noEmit
```

- [ ] **Step 4: Commit**

```bash
git add backend/src/services/offerLetter.ts backend/src/utils/appId.ts
git commit -m "feat: add offer letter generation orchestrator with App ID, PDF, and email"
```

---

### Task 7: Backend Leads & Forms API Routes

**Files:**
- Create: `backend/src/routes/leads.ts`, `backend/src/routes/forms.ts`
- Modify: `backend/src/app.ts` (add routes)

**Interfaces:**
- Produces (Leads):
  - `GET /api/leads` — list leads (agent: own; admin: all, filterable by agentId)
  - `POST /api/leads` — public endpoint, creates new lead + sends offer
  - `GET /api/leads/:id` — single lead detail
  - `PATCH /api/leads/:id` — update lead status/notes
- Produces (Forms):
  - `GET /api/forms` — list agent's forms
  - `POST /api/forms` — create form
  - `PATCH /api/forms/:id` — update form fields/active status
  - `DELETE /api/forms/:id` — deactivate

- [ ] **Step 1: Create leads routes**

Write `backend/src/routes/leads.ts`:
```ts
import { Router } from 'express'
import { authMiddleware } from '../middleware/auth'
import { SheetsService } from '../services/sheets'
import { generateAndSendOffer } from '../services/offerLetter'
import { AppError } from '../utils/errors'
import { z } from 'zod'
import rateLimit from 'express-rate-limit'

const router = Router()
const sheets = new SheetsService()

const leadSubmitSchema = z.object({
  fullName: z.string().min(1, 'Full name is required'),
  email: z.string().email('Valid email is required'),
  passport: z.string().min(1, 'Passport number is required'),
  structure: z.string().min(1),
  programme: z.string().min(1),
  agentId: z.string().min(1),
  formId: z.string().min(1),
})

const publicRateLimit = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  message: { error: 'Too many submissions. Please try again later.' },
})

router.post('/', publicRateLimit, async (req, res, next) => {
  try {
    const data = leadSubmitSchema.parse(req.body)

    // Look up agent name
    const agentRows = await sheets.getRows('Agents')
    const agentHeaders = agentRows[0]
    const agentIdCol = agentHeaders.indexOf('AgentID')
    const agentNameCol = agentHeaders.indexOf('Name')
    let agentName = 'Unknown'
    for (let i = 1; i < agentRows.length; i++) {
      if (agentRows[i][agentIdCol] === data.agentId) {
        agentName = agentRows[i][agentNameCol] || 'Unknown'
        break
      }
    }

    const result = await generateAndSendOffer({
      ...data,
      agentName,
    })

    res.status(201).json(result)
  } catch (err) {
    next(err)
  }
})

router.get('/', authMiddleware, async (req, res, next) => {
  try {
    const rows = await sheets.getRows('Leads')
    const headers = rows[0]
    const agentIdCol = headers.indexOf('AgentID')
    const appIdCol = headers.indexOf('ApplicationID')

    let leads = rows.slice(1).map(row => {
      const obj: Record<string, string> = {}
      headers.forEach((h, i) => { obj[h] = row[i] || '' })
      return obj
    })

    // Filter by agent unless admin
    if (req.user?.role === 'agent') {
      leads = leads.filter(l => l.AgentID === req.user?.agentId)
    } else if (req.user?.role === 'admin' && req.query.agentId) {
      leads = leads.filter(l => l.AgentID === req.query.agentId)
    }

    // Sort by timestamp descending
    leads.sort((a, b) => (b.Timestamp || '').localeCompare(a.Timestamp || ''))

    res.json({ leads })
  } catch (err) {
    next(err)
  }
})

router.get('/:appId', authMiddleware, async (req, res, next) => {
  try {
    const rows = await sheets.getRows('Leads')
    const headers = rows[0]
    const appIdCol = headers.indexOf('ApplicationID')
    const agentIdCol = headers.indexOf('AgentID')

    const row = rows.slice(1).find(r => r[appIdCol] === req.params.appId)
    if (!row) throw new AppError(404, 'Lead not found')

    if (req.user?.role === 'agent' && row[agentIdCol] !== req.user?.agentId) {
      throw new AppError(403, 'Access denied')
    }

    const lead: Record<string, string> = {}
    headers.forEach((h, i) => { lead[h] = row[i] || '' })
    res.json({ lead })
  } catch (err) {
    next(err)
  }
})

router.patch('/:appId', authMiddleware, async (req, res, next) => {
  try {
    const { status, notes } = req.body
    const rows = await sheets.getRows('Leads')
    const headers = rows[0]
    const appIdCol = headers.indexOf('ApplicationID')
    const agentIdCol = headers.indexOf('AgentID')
    const statusCol = headers.indexOf('Status')
    const notesCol = headers.indexOf('Notes')

    let rowIndex = -1
    for (let i = 1; i < rows.length; i++) {
      if (rows[i][appIdCol] === req.params.appId) {
        rowIndex = i
        break
      }
    }
    if (rowIndex === -1) throw new AppError(404, 'Lead not found')

    if (req.user?.role === 'agent' && rows[rowIndex][agentIdCol] !== req.user?.agentId) {
      throw new AppError(403, 'Access denied')
    }

    if (status) await sheets.updateCell('Leads', rowIndex + 1, statusCol + 1, status)
    if (notes !== undefined) await sheets.updateCell('Leads', rowIndex + 1, notesCol + 1, String(notes))

    res.json({ success: true })
  } catch (err) {
    next(err)
  }
})

export default router
```

- [ ] **Step 2: Create forms routes**

Write `backend/src/routes/forms.ts`:
```ts
import { Router } from 'express'
import { authMiddleware } from '../middleware/auth'
import { SheetsService } from '../services/sheets'
import { AppError } from '../utils/errors'
import { z } from 'zod'
import { v4 as uuid } from 'uuid'

const router = Router()
const sheets = new SheetsService()

router.use(authMiddleware)

const createFormSchema = z.object({
  formName: z.string().min(1),
  enabledFields: z.array(z.string()).optional(),
})

const updateFormSchema = z.object({
  formName: z.string().min(1).optional(),
  enabledFields: z.array(z.string()).optional(),
  active: z.boolean().optional(),
})

router.get('/', async (req, res, next) => {
  try {
    const rows = await sheets.getRows('Forms')
    const headers = rows[0]
    const agentIdCol = headers.indexOf('AgentID')

    let forms = rows.slice(1).map(row => {
      const obj: Record<string, string> = {}
      headers.forEach((h, i) => { obj[h] = row[i] || '' })
      return obj
    })

    if (req.user?.role === 'agent') {
      forms = forms.filter(f => f.AgentID === req.user?.agentId)
    } else if (req.user?.role === 'admin' && req.query.agentId) {
      forms = forms.filter(f => f.AgentID === req.query.agentId)
    }

    res.json({ forms })
  } catch (err) {
    next(err)
  }
})

router.post('/', async (req, res, next) => {
  try {
    const data = createFormSchema.parse(req.body)
    const formId = `FORM-${uuid().slice(0, 8).toUpperCase()}`
    const agentId = req.user!.agentId

    const enabledFields = JSON.stringify(data.enabledFields || [
      'fullName', 'email', 'passport', 'nationality',
      'structure', 'programme', 'campaign',
    ])

    await sheets.appendRow('Forms', [
      formId,
      data.formName,
      agentId,
      `/form/${agentId}/${formId}`,
      enabledFields,
      'true',
      new Date().toISOString(),
    ])

    res.status(201).json({
      form: {
        FormID: formId,
        FormName: data.formName,
        AgentID: agentId,
        PublicURL: `/form/${agentId}/${formId}`,
        EnabledFields: data.enabledFields,
        Active: true,
      },
    })
  } catch (err) {
    next(err)
  }
})

router.patch('/:id', async (req, res, next) => {
  try {
    const data = updateFormSchema.parse(req.body)
    const rows = await sheets.getRows('Forms')
    const headers = rows[0]
    const formIdCol = headers.indexOf('FormID')
    const agentIdCol = headers.indexOf('AgentID')

    let rowIndex = -1
    for (let i = 1; i < rows.length; i++) {
      if (rows[i][formIdCol] === req.params.id) {
        if (req.user?.role === 'agent' && rows[i][agentIdCol] !== req.user?.agentId) {
          throw new AppError(403, 'Access denied')
        }
        rowIndex = i
        break
      }
    }
    if (rowIndex === -1) throw new AppError(404, 'Form not found')

    if (data.formName) {
      const nameCol = headers.indexOf('FormName')
      await sheets.updateCell('Forms', rowIndex + 1, nameCol + 1, data.formName)
    }
    if (data.enabledFields) {
      const fieldsCol = headers.indexOf('EnabledFields')
      await sheets.updateCell('Forms', rowIndex + 1, fieldsCol + 1, JSON.stringify(data.enabledFields))
    }
    if (data.active !== undefined) {
      const activeCol = headers.indexOf('Active')
      await sheets.updateCell('Forms', rowIndex + 1, activeCol + 1, String(data.active))
    }

    res.json({ success: true })
  } catch (err) {
    next(err)
  }
})

router.delete('/:id', async (req, res, next) => {
  try {
    const rows = await sheets.getRows('Forms')
    const headers = rows[0]
    const formIdCol = headers.indexOf('FormID')
    const agentIdCol = headers.indexOf('AgentID')
    const activeCol = headers.indexOf('Active')

    let rowIndex = -1
    for (let i = 1; i < rows.length; i++) {
      if (rows[i][formIdCol] === req.params.id) {
        if (req.user?.role === 'agent' && rows[i][agentIdCol] !== req.user?.agentId) {
          throw new AppError(403, 'Access denied')
        }
        rowIndex = i
        break
      }
    }
    if (rowIndex === -1) throw new AppError(404, 'Form not found')

    await sheets.updateCell('Forms', rowIndex + 1, activeCol + 1, 'false')
    res.json({ success: true })
  } catch (err) {
    next(err)
  }
})

export default router
```

- [ ] **Step 3: Register routes in app**

Add to `backend/src/app.ts`:
```ts
import leadsRoutes from './routes/leads'
import formsRoutes from './routes/forms'

app.use('/api/leads', leadsRoutes)
app.use('/api/forms', formsRoutes)
```

- [ ] **Step 4: Verify TypeScript compiles**

```bash
cd backend && npx tsc --noEmit
```

- [ ] **Step 5: Commit**

```bash
git add backend/src/routes/leads.ts backend/src/routes/forms.ts backend/src/app.ts
git commit -m "feat: add leads and forms API routes"
```

---

### Task 8: Backend Dashboard API Route

**Files:**
- Create: `backend/src/routes/dashboard.ts`
- Modify: `backend/src/app.ts` (add route)

**Interfaces:**
- Produces:
  - `GET /api/dashboard/summary` — returns { totalLeads, offersSent, accepted, conversionRate } scoped to agent or all

- [ ] **Step 1: Create dashboard route**

Write `backend/src/routes/dashboard.ts`:
```ts
import { Router } from 'express'
import { authMiddleware } from '../middleware/auth'
import { SheetsService } from '../services/sheets'

const router = Router()
const sheets = new SheetsService()

router.use(authMiddleware)

router.get('/summary', async (req, res, next) => {
  try {
    const rows = await sheets.getRows('Leads')
    const headers = rows[0]
    const agentIdCol = headers.indexOf('AgentID')
    const statusCol = headers.indexOf('Status')

    let leads = rows.slice(1).map(row => {
      const obj: Record<string, string> = {}
      headers.forEach((h, i) => { obj[h] = row[i] || '' })
      return obj
    })

    if (req.user?.role === 'agent') {
      leads = leads.filter(l => l.AgentID === req.user?.agentId)
    } else if (req.user?.role === 'admin' && req.query.agentId) {
      leads = leads.filter(l => l.AgentID === req.query.agentId)
    }

    const totalLeads = leads.length
    const offersSent = leads.filter(l =>
      l.Status === 'Offer Sent' || l.Status === 'Accepted' || l.Status === 'Enrolled'
    ).length
    const accepted = leads.filter(l =>
      l.Status === 'Accepted' || l.Status === 'Enrolled'
    ).length
    const enrolled = leads.filter(l => l.Status === 'Enrolled').length
    const conversionRate = totalLeads > 0 ? Math.round((accepted / totalLeads) * 100) : 0

    res.json({
      summary: {
        totalLeads,
        offersSent,
        accepted,
        enrolled,
        conversionRate,
      },
    })
  } catch (err) {
    next(err)
  }
})

export default router
```

- [ ] **Step 2: Register dashboard route**

Add to `backend/src/app.ts`:
```ts
import dashboardRoutes from './routes/dashboard'
app.use('/api/dashboard', dashboardRoutes)
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
cd backend && npx tsc --noEmit
```

- [ ] **Step 4: Commit**

```bash
git add backend/src/routes/dashboard.ts backend/src/app.ts
git commit -m "feat: add dashboard summary API route"
```

---

### Task 9: Frontend shadcn/ui Initialization + Theme Provider

**Files:**
- Create: `frontend/components.json`
- Create: `frontend/src/lib/utils.ts`, `frontend/src/components/layout/ThemeProvider.tsx`
- Create: Select shadcn/ui components: button, input, card, table, badge, dialog, select, label, checkbox, avatar, dropdown-menu, separator, sheet, sonner

**Interfaces:**
- Produces:
  - shadcn/ui components in `frontend/src/components/ui/`
  - `cn()` utility
  - `ThemeProvider` with dark/light toggle, persisted in localStorage
  - `Toaster` from sonner

- [ ] **Step 1: Initialize shadcn/ui**

```bash
cd frontend && npx shadcn@latest init -d --force
```
Expected: Creates `components.json` and `src/lib/utils.ts`.

Select "New York" style, "Neutral" base color, CSS variables enabled.

- [ ] **Step 2: Add shadcn/ui components**

```bash
cd frontend && npx shadcn@latest add button input card table badge dialog select label checkbox avatar dropdown-menu separator sheet sonner --yes
```

- [ ] **Step 3: Create ThemeProvider**

Write `frontend/src/components/layout/ThemeProvider.tsx`:
```tsx
import { createContext, useContext, useEffect, useState, ReactNode } from 'react'

type Theme = 'dark' | 'light'

interface ThemeContextValue {
  theme: Theme
  toggleTheme: () => void
}

const ThemeContext = createContext<ThemeContextValue>({
  theme: 'dark',
  toggleTheme: () => {},
})

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useState<Theme>(() => {
    const stored = localStorage.getItem('ugs-theme')
    return (stored === 'light' || stored === 'dark') ? stored : 'dark'
  })

  useEffect(() => {
    const root = document.documentElement
    root.classList.remove('light', 'dark')
    root.classList.add(theme)
    localStorage.setItem('ugs-theme', theme)
  }, [theme])

  const toggleTheme = () => setTheme(prev => prev === 'dark' ? 'light' : 'dark')

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  )
}

export function useTheme() {
  return useContext(ThemeContext)
}
```

- [ ] **Step 4: Verify frontend compiles**

```bash
cd frontend && npx tsc --noEmit
```

- [ ] **Step 5: Commit**

```bash
git add frontend/
git commit -m "feat: initialize shadcn/ui, add ThemeProvider with dark/light toggle"
```

---

### Task 10: Frontend Types + API Layer + Auth Context

**Files:**
- Create: `frontend/src/types/index.ts`, `frontend/src/lib/api.ts`, `frontend/src/lib/auth.tsx`
- Create: `frontend/src/components/shared/ProtectedRoute.tsx`

**Interfaces:**
- Produces:
  - `types/index.ts` — `User`, `Lead`, `Agent`, `Form`, `DashboardSummary`
  - `lib/api.ts` — Axios instance with `/api` base, credentials
  - `lib/auth.tsx` — `AuthProvider` with `login()`, `logout()`, `user`, `loading`
  - `ProtectedRoute.tsx` — redirects to `/login` if not authenticated

- [ ] **Step 1: Create types**

Write `frontend/src/types/index.ts`:
```ts
export interface User {
  agentId: string
  email: string
  name: string
  role: 'agent' | 'admin'
}

export interface Lead {
  ApplicationID: string
  Timestamp: string
  FullName: string
  Email: string
  Passport: string
  Nationality: string
  Structure: string
  Programme: string
  ProgrammeLevel: string
  Campaign: string
  AgentID: string
  AgentName: string
  FormID: string
  Status: string
  OfferPDF: string
  Notes: string
}

export interface Agent {
  AgentID: string
  Name: string
  Email: string
  Role: string
  Status: string
  FormsAssigned: string
  CreatedAt: string
}

export interface FormRecord {
  FormID: string
  FormName: string
  AgentID: string
  PublicURL: string
  EnabledFields: string
  Active: string
  CreatedAt: string
}

export interface DashboardSummary {
  totalLeads: number
  offersSent: number
  accepted: number
  enrolled: number
  conversionRate: number
}
```

- [ ] **Step 2: Create API client**

Write `frontend/src/lib/api.ts`:
```ts
import axios from 'axios'

export const api = axios.create({
  baseURL: '/api',
  withCredentials: true,
  headers: { 'Content-Type': 'application/json' },
})

api.interceptors.response.use(
  res => res,
  err => {
    if (err.response?.status === 401) {
      if (window.location.pathname !== '/login') {
        window.location.href = '/login'
      }
    }
    return Promise.reject(err)
  },
)
```

- [ ] **Step 3: Create Auth context**

Write `frontend/src/lib/auth.tsx`:
```tsx
import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react'
import { api } from './api'
import type { User } from '../types'

interface AuthContextValue {
  user: User | null
  loading: boolean
  login: (credential: string) => Promise<void>
  logout: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue>({
  user: null,
  loading: true,
  login: async () => {},
  logout: async () => {},
})

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api.get('/auth/me')
      .then(res => setUser(res.data.user))
      .catch(() => setUser(null))
      .finally(() => setLoading(false))
  }, [])

  const login = useCallback(async (credential: string) => {
    const res = await api.post('/auth/google', { credential })
    setUser(res.data.user)
  }, [])

  const logout = useCallback(async () => {
    await api.post('/auth/logout')
    setUser(null)
  }, [])

  return (
    <AuthContext.Provider value={{ user, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  return useContext(AuthContext)
}
```

- [ ] **Step 4: Create ProtectedRoute**

Write `frontend/src/components/shared/ProtectedRoute.tsx`:
```tsx
import { Navigate } from 'react-router-dom'
import { useAuth } from '../../lib/auth'

export function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth()

  if (loading) {
    return <div className="flex items-center justify-center min-h-screen bg-background text-foreground">Loading...</div>
  }

  if (!user) {
    return <Navigate to="/login" replace />
  }

  return <>{children}</>
}
```

- [ ] **Step 5: Verify TypeScript compiles**

```bash
cd frontend && npx tsc --noEmit
```

- [ ] **Step 6: Commit**

```bash
git add frontend/src/types/ frontend/src/lib/ frontend/src/components/shared/
git commit -m "feat: add types, API client, auth context, and protected route"
```

---

### Task 11: Frontend Layout (Sidebar + Header + App Shell)

**Files:**
- Create: `frontend/src/components/layout/Sidebar.tsx`, `frontend/src/components/layout/Header.tsx`, `frontend/src/components/layout/AppLayout.tsx`
- Modify: `frontend/src/App.tsx` (use layout + routes)

**Interfaces:**
- Produces:
  - `AppLayout` — sidebar + header + main content area
  - `Sidebar` — navigation items based on role
  - `Header` — logo, theme toggle, notification bell placeholder, user dropdown

- [ ] **Step 1: Create Sidebar**

Write `frontend/src/components/layout/Sidebar.tsx`:
```tsx
import { NavLink } from 'react-router-dom'
import { useAuth } from '../../lib/auth'
import { LayoutDashboard, Users, FileText, FormInput, GraduationCap } from 'lucide-react'
import { cn } from '../../lib/utils'

interface NavItem {
  to: string
  label: string
  icon: React.ElementType
  adminOnly?: boolean
}

export function Sidebar() {
  const { user } = useAuth()

  const navItems: NavItem[] = [
    { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { to: '/leads', label: 'My Leads', icon: Users },
    { to: '/forms', label: 'My Forms', icon: FormInput },
    { to: '/agents', label: 'All Agents', icon: GraduationCap, adminOnly: true },
  ]

  const visible = navItems.filter(item => !item.adminOnly || user?.role === 'admin')

  return (
    <aside className="w-64 bg-surface border-r border-border flex flex-col h-screen">
      <div className="p-4 border-b border-border">
        <h1 className="text-lg font-bold text-primary">UniSZA Graduate School</h1>
        <p className="text-xs text-muted mt-1">Agent Tracking System</p>
      </div>
      <nav className="flex-1 p-2 space-y-1">
        {visible.map(item => (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) =>
              cn(
                'flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors',
                isActive
                  ? 'bg-primary text-primary-foreground'
                  : 'text-foreground hover:bg-border/30',
              )
            }
          >
            <item.icon className="w-5 h-5" />
            {item.label}
          </NavLink>
        ))}
      </nav>
    </aside>
  )
}
```

- [ ] **Step 2: Create Header**

Write `frontend/src/components/layout/Header.tsx`:
```tsx
import { Moon, Sun, Bell, LogOut } from 'lucide-react'
import { useTheme } from './ThemeProvider'
import { useAuth } from '../../lib/auth'
import { Button } from '../ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '../ui/dropdown-menu'
import { Avatar, AvatarFallback } from '../ui/avatar'

export function Header() {
  const { theme, toggleTheme } = useTheme()
  const { user, logout } = useAuth()

  const initials = user?.name
    ?.split(' ')
    .map(n => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2) || '?'

  return (
    <header className="h-14 bg-surface border-b border-border flex items-center justify-between px-6">
      <div className="text-sm text-muted">
        {user?.role === 'admin' ? 'Administrator' : 'Agent'} — {user?.name}
      </div>
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="icon" onClick={toggleTheme}>
          {theme === 'dark' ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
        </Button>

        <Button variant="ghost" size="icon">
          <Bell className="w-5 h-5" />
        </Button>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon">
              <Avatar className="w-8 h-8">
                <AvatarFallback className="text-xs bg-primary text-primary-foreground">
                  {initials}
                </AvatarFallback>
              </Avatar>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem className="text-sm">{user?.email}</DropdownMenuItem>
            <DropdownMenuItem onClick={logout} className="text-danger">
              <LogOut className="w-4 h-4 mr-2" />
              Sign out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  )
}
```

- [ ] **Step 3: Create AppLayout**

Write `frontend/src/components/layout/AppLayout.tsx`:
```tsx
import { Outlet } from 'react-router-dom'
import { Sidebar } from './Sidebar'
import { Header } from './Header'

export function AppLayout() {
  return (
    <div className="flex h-screen bg-background">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0">
        <Header />
        <main className="flex-1 overflow-auto p-6">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Update App.tsx with routing**

Rewrite `frontend/src/App.tsx`:
```tsx
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ThemeProvider } from './components/layout/ThemeProvider'
import { AuthProvider } from './lib/auth'
import { AppLayout } from './components/layout/AppLayout'
import { ProtectedRoute } from './components/shared/ProtectedRoute'
import LoginPage from './pages/LoginPage'
import DashboardPage from './pages/DashboardPage'
import LeadsPage from './pages/LeadsPage'
import FormsPage from './pages/FormsPage'
import AgentsPage from './pages/AgentsPage'
import PublicFormPage from './pages/PublicFormPage'
import { Toaster } from './components/ui/sonner'

const queryClient = new QueryClient()

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <AuthProvider>
          <BrowserRouter>
            <Routes>
              <Route path="/form/:agentId/:formId" element={<PublicFormPage />} />
              <Route path="/login" element={<LoginPage />} />
              <Route element={<ProtectedRoute><AppLayout /></ProtectedRoute>}>
                <Route path="/dashboard" element={<DashboardPage />} />
                <Route path="/leads" element={<LeadsPage />} />
                <Route path="/forms" element={<FormsPage />} />
                <Route path="/agents" element={<AgentsPage />} />
                <Route path="/" element={<DashboardPage />} />
              </Route>
            </Routes>
          </BrowserRouter>
          <Toaster />
        </AuthProvider>
      </ThemeProvider>
    </QueryClientProvider>
  )
}
```

- [ ] **Step 5: Verify frontend compiles**

```bash
cd frontend && npx tsc --noEmit
```

- [ ] **Step 6: Commit**

```bash
git add frontend/src/components/layout/ frontend/src/App.tsx
git commit -m "feat: add app layout with sidebar, header, routing, and providers"
```

---

### Task 12: Frontend Login Page

**Files:**
- Create: `frontend/src/pages/LoginPage.tsx`
- Modify: `frontend/src/main.tsx` (add Google OAuth provider)

**Interfaces:**
- Produces: Login page with Google sign-in button using `@react-oauth/google`

- [ ] **Step 1: Add Google OAuth provider to main.tsx**

Rewrite `frontend/src/main.tsx`:
```tsx
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { GoogleOAuthProvider } from '@react-oauth/google'
import './index.css'
import App from './App'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <GoogleOAuthProvider clientId={import.meta.env.VITE_GOOGLE_CLIENT_ID || ''}>
      <App />
    </GoogleOAuthProvider>
  </StrictMode>,
)
```

Create `frontend/.env`:
```
VITE_GOOGLE_CLIENT_ID=your-google-client-id.apps.googleusercontent.com
```

- [ ] **Step 2: Create LoginPage**

Write `frontend/src/pages/LoginPage.tsx`:
```tsx
import { useNavigate } from 'react-router-dom'
import { GoogleLogin } from '@react-oauth/google'
import { useAuth } from '../lib/auth'
import { toast } from 'sonner'
import { GraduationCap } from 'lucide-react'
import { useEffect } from 'react'

export default function LoginPage() {
  const { user, login } = useAuth()
  const navigate = useNavigate()

  useEffect(() => {
    if (user) navigate('/dashboard', { replace: true })
  }, [user, navigate])

  const handleSuccess = async (credentialResponse: { credential?: string }) => {
    try {
      if (!credentialResponse.credential) return
      await login(credentialResponse.credential)
      navigate('/dashboard', { replace: true })
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Login failed')
    }
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <div className="w-full max-w-sm p-8 bg-surface rounded-xl border border-border shadow-lg text-center">
        <GraduationCap className="w-12 h-12 text-primary mx-auto mb-4" />
        <h1 className="text-xl font-bold text-foreground mb-2">
          UniSZA Graduate School
        </h1>
        <p className="text-sm text-muted mb-6">
          Agent Tracking & Student Pipeline
        </p>
        <div className="flex justify-center">
          <GoogleLogin
            onSuccess={handleSuccess}
            onError={() => toast.error('Google sign-in failed')}
            theme="outline"
            size="large"
            shape="rectangular"
            text="signin_with"
          />
        </div>
        <p className="text-xs text-muted mt-4">
          Sign in with your authorized UniSZA Google account
        </p>
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Verify frontend compiles**

```bash
cd frontend && npx tsc --noEmit
```

- [ ] **Step 4: Commit**

```bash
git add frontend/src/main.tsx frontend/src/pages/LoginPage.tsx frontend/.env
git commit -m "feat: add Google OAuth login page"
```

---

### Task 13: Frontend Shared Components + Data Hooks

**Files:**
- Create: `frontend/src/components/shared/DataTable.tsx`, `frontend/src/components/shared/StatusBadge.tsx`
- Create: `frontend/src/hooks/useLeads.ts`, `frontend/src/hooks/useAgents.ts`, `frontend/src/hooks/useForms.ts`

**Interfaces:**
- Produces:
  - `DataTable<T>` — generic sortable/paginated table using TanStack Table
  - `StatusBadge` — colored badge for lead statuses
  - `useLeads()` — TanStack Query hook for leads CRUD
  - `useAgents()` — TanStack Query hook for agents CRUD
  - `useForms()` — TanStack Query hook for forms CRUD

- [ ] **Step 1: Create StatusBadge**

Write `frontend/src/components/shared/StatusBadge.tsx`:
```tsx
import { cn } from '../../lib/utils'

interface StatusBadgeProps {
  status: string
}

const statusColors: Record<string, string> = {
  'New Lead': 'bg-blue-500/10 text-blue-400 border-blue-500/30',
  'Offer Sent': 'bg-amber-500/10 text-amber-400 border-amber-500/30',
  'Accepted': 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30',
  'Enrolled': 'bg-primary/10 text-primary border-primary/30',
  'Declined': 'bg-danger/10 text-danger border-danger/30',
}

export function StatusBadge({ status }: StatusBadgeProps) {
  return (
    <span className={cn(
      'inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border',
      statusColors[status] || 'bg-muted/10 text-muted border-muted/30',
    )}>
      {status}
    </span>
  )
}
```

- [ ] **Step 2: Create DataTable**

Write `frontend/src/components/shared/DataTable.tsx`:
```tsx
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  getPaginationRowModel,
  getFilteredRowModel,
  flexRender,
  ColumnDef,
  SortingState,
} from '@tanstack/react-table'
import { useState } from 'react'
import { Button } from '../ui/button'
import { Input } from '../ui/input'
import { ChevronLeft, ChevronRight, Search } from 'lucide-react'

interface DataTableProps<T> {
  columns: ColumnDef<T, any>[]
  data: T[]
  searchPlaceholder?: string
}

export function DataTable<T>({ columns, data, searchPlaceholder = 'Search...' }: DataTableProps<T>) {
  const [sorting, setSorting] = useState<SortingState>([])
  const [globalFilter, setGlobalFilter] = useState('')

  const table = useReactTable({
    data,
    columns,
    state: { sorting, globalFilter },
    onSortingChange: setSorting,
    onGlobalFilterChange: setGlobalFilter,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
  })

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Search className="w-4 h-4 text-muted" />
        <Input
          placeholder={searchPlaceholder}
          value={globalFilter}
          onChange={e => setGlobalFilter(e.target.value)}
          className="max-w-sm bg-surface border-border"
        />
      </div>

      <div className="rounded-lg border border-border overflow-hidden">
        <table className="w-full">
          <thead className="bg-surface/50">
            {table.getHeaderGroups().map(headerGroup => (
              <tr key={headerGroup.id}>
                {headerGroup.headers.map(header => (
                  <th
                    key={header.id}
                    className="px-4 py-3 text-left text-xs font-medium text-muted uppercase tracking-wider cursor-pointer select-none"
                    onClick={header.column.getToggleSortingHandler()}
                  >
                    {flexRender(header.column.columnDef.header, header.getContext())}
                  </th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody className="divide-y divide-border">
            {table.getRowModel().rows.map(row => (
              <tr key={row.id} className="hover:bg-surface/30 transition-colors">
                {row.getVisibleCells().map(cell => (
                  <td key={cell.id} className="px-4 py-3 text-sm text-foreground">
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </td>
                ))}
              </tr>
            ))}
            {table.getRowModel().rows.length === 0 && (
              <tr>
                <td colSpan={columns.length} className="px-4 py-8 text-center text-muted text-sm">
                  No data found
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-between">
        <span className="text-sm text-muted">
          {table.getFilteredRowModel().rows.length} results
        </span>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => table.previousPage()}
            disabled={!table.getCanPreviousPage()}
          >
            <ChevronLeft className="w-4 h-4" />
          </Button>
          <span className="text-sm text-muted">
            {table.getState().pagination.pageIndex + 1} / {table.getPageCount()}
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => table.nextPage()}
            disabled={!table.getCanNextPage()}
          >
            <ChevronRight className="w-4 h-4" />
          </Button>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Create data hooks**

Write `frontend/src/hooks/useLeads.ts`:
```ts
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '../lib/api'
import type { Lead, DashboardSummary } from '../types'

export function useLeads() {
  return useQuery({
    queryKey: ['leads'],
    queryFn: async () => {
      const { data } = await api.get('/leads')
      return data.leads as Lead[]
    },
  })
}

export function useLead(appId: string) {
  return useQuery({
    queryKey: ['lead', appId],
    queryFn: async () => {
      const { data } = await api.get(`/leads/${appId}`)
      return data.lead as Lead
    },
  })
}

export function useUpdateLead() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ appId, status, notes }: { appId: string; status?: string; notes?: string }) => {
      const { data } = await api.patch(`/leads/${appId}`, { status, notes })
      return data
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['leads'] }) },
  })
}

export function useDashboardSummary() {
  return useQuery({
    queryKey: ['dashboard', 'summary'],
    queryFn: async () => {
      const { data } = await api.get('/dashboard/summary')
      return data.summary as DashboardSummary
    },
  })
}
```

Write `frontend/src/hooks/useAgents.ts`:
```ts
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '../lib/api'
import type { Agent } from '../types'

export function useAgents() {
  return useQuery({
    queryKey: ['agents'],
    queryFn: async () => {
      const { data } = await api.get('/agents')
      return data.agents as Agent[]
    },
  })
}

export function useCreateAgent() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (agent: { name: string; email: string; role: string }) => {
      const { data } = await api.post('/agents', agent)
      return data
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['agents'] }) },
  })
}

export function useUpdateAgent() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, ...updates }: { id: string; name?: string; role?: string; status?: string }) => {
      const { data } = await api.patch(`/agents/${id}`, updates)
      return data
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['agents'] }) },
  })
}

export function useDeleteAgent() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { data } = await api.delete(`/agents/${id}`)
      return data
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['agents'] }) },
  })
}
```

Write `frontend/src/hooks/useForms.ts`:
```ts
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '../lib/api'
import type { FormRecord } from '../types'

export function useForms() {
  return useQuery({
    queryKey: ['forms'],
    queryFn: async () => {
      const { data } = await api.get('/forms')
      return data.forms as FormRecord[]
    },
  })
}

export function useCreateForm() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (form: { formName: string; enabledFields?: string[] }) => {
      const { data } = await api.post('/forms', form)
      return data
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['forms'] }) },
  })
}

export function useUpdateForm() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, ...updates }: { id: string; formName?: string; enabledFields?: string[]; active?: boolean }) => {
      const { data } = await api.patch(`/forms/${id}`, updates)
      return data
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['forms'] }) },
  })
}

export function useDeleteForm() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { data } = await api.delete(`/forms/${id}`)
      return data
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['forms'] }) },
  })
}
```

- [ ] **Step 4: Verify frontend compiles**

```bash
cd frontend && npx tsc --noEmit
```

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/shared/ frontend/src/hooks/
git commit -m "feat: add DataTable, StatusBadge, and TanStack Query data hooks"
```

---

### Task 14: Frontend Page Components (Dashboard, Leads, Agents)

**Files:**
- Create: `frontend/src/pages/DashboardPage.tsx`
- Create: `frontend/src/pages/LeadsPage.tsx`
- Create: `frontend/src/pages/AgentsPage.tsx`
- Create: `frontend/src/components/dashboard/SummaryCards.tsx`
- Create: `frontend/src/components/leads/LeadsTable.tsx`
- Create: `frontend/src/components/agents/AgentManager.tsx`

**Interfaces:**
- Produces: Working dashboard, leads, and agents pages

- [ ] **Step 1: Create SummaryCards**

Write `frontend/src/components/dashboard/SummaryCards.tsx`:
```tsx
import { useDashboardSummary } from '../../hooks/useLeads'
import { Users, Send, CheckCircle, TrendingUp } from 'lucide-react'
import { Card, CardContent } from '../ui/card'

export function SummaryCards() {
  const { data, isLoading } = useDashboardSummary()

  const cards = [
    { label: 'Total Leads', value: data?.totalLeads ?? 0, icon: Users, color: 'text-blue-400' },
    { label: 'Offers Sent', value: data?.offersSent ?? 0, icon: Send, color: 'text-amber-400' },
    { label: 'Accepted', value: data?.accepted ?? 0, icon: CheckCircle, color: 'text-emerald-400' },
    { label: 'Conversion', value: `${data?.conversionRate ?? 0}%`, icon: TrendingUp, color: 'text-primary' },
  ]

  if (isLoading) return <div className="text-muted text-sm">Loading...</div>

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {cards.map(card => (
        <Card key={card.label} className="bg-surface border-border">
          <CardContent className="p-4 flex items-center gap-4">
            <card.icon className={`w-8 h-8 ${card.color}`} />
            <div>
              <p className="text-xs text-muted uppercase tracking-wider">{card.label}</p>
              <p className="text-2xl font-bold text-foreground">{card.value}</p>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}
```

- [ ] **Step 2: Create LeadsTable**

Write `frontend/src/components/leads/LeadsTable.tsx`:
```tsx
import { ColumnDef } from '@tanstack/react-table'
import { DataTable } from '../shared/DataTable'
import { StatusBadge } from '../shared/StatusBadge'
import { useLeads } from '../../hooks/useLeads'
import type { Lead } from '../../types'

const columns: ColumnDef<Lead>[] = [
  { accessorKey: 'ApplicationID', header: 'App ID', cell: info => (
    <span className="font-mono text-xs">{info.getValue<string>()}</span>
  )},
  { accessorKey: 'FullName', header: 'Name' },
  { accessorKey: 'Programme', header: 'Programme', cell: info => (
    <span className="text-xs">{info.getValue<string>()}</span>
  )},
  { accessorKey: 'ProgrammeLevel', header: 'Level' },
  { accessorKey: 'Status', header: 'Status', cell: info => (
    <StatusBadge status={info.getValue<string>()} />
  )},
  { accessorKey: 'Timestamp', header: 'Date', cell: info => {
    const ts = info.getValue<string>()
    return ts ? new Date(ts).toLocaleDateString() : '-'
  }},
]

export function LeadsTable() {
  const { data: leads, isLoading } = useLeads()

  if (isLoading) return <div className="text-muted">Loading leads...</div>

  return <DataTable columns={columns} data={leads || []} searchPlaceholder="Search leads..." />
}
```

- [ ] **Step 3: Create AgentManager**

Write `frontend/src/components/agents/AgentManager.tsx`:
```tsx
import { useState } from 'react'
import { useAgents, useCreateAgent, useUpdateAgent, useDeleteAgent } from '../../hooks/useAgents'
import { Button } from '../ui/button'
import { Input } from '../ui/input'
import { Label } from '../ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '../ui/dialog'
import { Card, CardContent } from '../ui/card'
import { Plus, MoreVertical } from 'lucide-react'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '../ui/dropdown-menu'
import { Badge } from '../ui/badge'
import { toast } from 'sonner'

export function AgentManager() {
  const { data: agents, isLoading } = useAgents()
  const createAgent = useCreateAgent()
  const updateAgent = useUpdateAgent()
  const deleteAgent = useDeleteAgent()
  const [open, setOpen] = useState(false)
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [role, setRole] = useState<'agent' | 'admin'>('agent')

  const handleCreate = async () => {
    try {
      await createAgent.mutateAsync({ name, email, role })
      toast.success('Agent added')
      setOpen(false)
      setName('')
      setEmail('')
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Failed')
    }
  }

  if (isLoading) return <div className="text-muted">Loading agents...</div>

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="text-lg font-semibold text-foreground">Agents</h2>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button size="sm"><Plus className="w-4 h-4 mr-1" /> Add Agent</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Add New Agent</DialogTitle></DialogHeader>
            <div className="space-y-4">
              <div>
                <Label>Name</Label>
                <Input value={name} onChange={e => setName(e.target.value)} />
              </div>
              <div>
                <Label>Email (Google account)</Label>
                <Input value={email} onChange={e => setEmail(e.target.value)} type="email" />
              </div>
              <div>
                <Label>Role</Label>
                <Select value={role} onValueChange={v => setRole(v as 'agent' | 'admin')}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="agent">Agent</SelectItem>
                    <SelectItem value="admin">Admin</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Button onClick={handleCreate} disabled={createAgent.isPending}>
                Create Agent
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {agents?.map(agent => (
          <Card key={agent.AgentID} className="bg-surface border-border">
            <CardContent className="p-4">
              <div className="flex justify-between items-start">
                <div>
                  <p className="font-medium text-foreground">{agent.Name}</p>
                  <p className="text-xs text-muted">{agent.Email}</p>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant={agent.Status === 'active' ? 'default' : 'secondary'}>
                    {agent.Status}
                  </Badge>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon"><MoreVertical className="w-4 h-4" /></Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => {
                        updateAgent.mutate({ id: agent.AgentID, status: agent.Status === 'active' ? 'suspended' : 'active' })
                        toast.success('Status updated')
                      }}>
                        {agent.Status === 'active' ? 'Suspend' : 'Activate'}
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => {
                        deleteAgent.mutate(agent.AgentID)
                        toast.success('Agent deactivated')
                      }} className="text-danger">
                        Deactivate
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Create page components**

Write `frontend/src/pages/DashboardPage.tsx`:
```tsx
import { SummaryCards } from '../components/dashboard/SummaryCards'
import { LeadsTable } from '../components/leads/LeadsTable'

export default function DashboardPage() {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-foreground">Dashboard</h1>
      <SummaryCards />
      <div>
        <h2 className="text-lg font-semibold text-foreground mb-4">Recent Leads</h2>
        <LeadsTable />
      </div>
    </div>
  )
}
```

Write `frontend/src/pages/LeadsPage.tsx`:
```tsx
import { LeadsTable } from '../components/leads/LeadsTable'

export default function LeadsPage() {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-foreground">My Leads</h1>
      <LeadsTable />
    </div>
  )
}
```

Write `frontend/src/pages/AgentsPage.tsx`:
```tsx
import { useAuth } from '../lib/auth'
import { AgentManager } from '../components/agents/AgentManager'
import { Navigate } from 'react-router-dom'

export default function AgentsPage() {
  const { user } = useAuth()
  if (user?.role !== 'admin') return <Navigate to="/dashboard" replace />

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-foreground">Agent Management</h1>
      <AgentManager />
    </div>
  )
}
```

- [ ] **Step 5: Verify TypeScript compiles**

```bash
cd frontend && npx tsc --noEmit
```

- [ ] **Step 6: Commit**

```bash
git add frontend/src/pages/DashboardPage.tsx frontend/src/pages/LeadsPage.tsx frontend/src/pages/AgentsPage.tsx frontend/src/components/dashboard/ frontend/src/components/leads/ frontend/src/components/agents/
git commit -m "feat: add dashboard, leads, and agent management pages"
```

---

### Task 15: Frontend Forms Page + Public Form

**Files:**
- Create: `frontend/src/pages/FormsPage.tsx`
- Create: `frontend/src/pages/PublicFormPage.tsx`
- Create: `frontend/src/components/forms/FormManager.tsx`
- Create: `frontend/src/components/forms/FormBuilder.tsx`

**Interfaces:**
- Produces:
  - Forms page: create form, toggle fields, copy link, deactivate
  - Public form: branded form that submits to POST `/api/leads`

- [ ] **Step 1: Create FormManager**

Write `frontend/src/components/forms/FormManager.tsx`:
```tsx
import { useState } from 'react'
import { useForms, useCreateForm, useDeleteForm } from '../../hooks/useForms'
import { Button } from '../ui/button'
import { Input } from '../ui/input'
import { Label } from '../ui/label'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '../ui/dialog'
import { Card, CardContent } from '../ui/card'
import { Plus, Copy, ExternalLink, Trash2 } from 'lucide-react'
import { Badge } from '../ui/badge'
import { toast } from 'sonner'

export function FormManager() {
  const { data: forms, isLoading } = useForms()
  const createForm = useCreateForm()
  const deleteForm = useDeleteForm()
  const [open, setOpen] = useState(false)
  const [formName, setFormName] = useState('')

  const handleCreate = async () => {
    try {
      await createForm.mutateAsync({ formName })
      toast.success('Form created')
      setOpen(false)
      setFormName('')
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Failed')
    }
  }

  const copyLink = (url: string) => {
    const fullUrl = `${window.location.origin}${url}`
    navigator.clipboard.writeText(fullUrl)
    toast.success('Link copied!')
  }

  if (isLoading) return <div className="text-muted">Loading forms...</div>

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="text-lg font-semibold text-foreground">Forms</h2>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button size="sm"><Plus className="w-4 h-4 mr-1" /> New Form</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Create New Form</DialogTitle></DialogHeader>
            <div className="space-y-4">
              <div>
                <Label>Form Name</Label>
                <Input value={formName} onChange={e => setFormName(e.target.value)} placeholder="e.g., UGS Tour KL 2026" />
              </div>
              <Button onClick={handleCreate} disabled={createForm.isPending}>Create</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {forms?.map(form => (
          <Card key={form.FormID} className="bg-surface border-border">
            <CardContent className="p-4">
              <div className="flex justify-between items-start">
                <div>
                  <p className="font-medium text-foreground">{form.FormName}</p>
                  <p className="text-xs text-muted font-mono">{form.FormID}</p>
                </div>
                <Badge variant={form.Active === 'true' ? 'default' : 'secondary'}>
                  {form.Active === 'true' ? 'Active' : 'Inactive'}
                </Badge>
              </div>
              <div className="flex gap-2 mt-4">
                <Button size="sm" variant="outline" onClick={() => copyLink(form.PublicURL)}>
                  <Copy className="w-4 h-4 mr-1" /> Copy Link
                </Button>
                <Button size="sm" variant="outline" asChild>
                  <a href={form.PublicURL} target="_blank" rel="noopener">
                    <ExternalLink className="w-4 h-4 mr-1" /> Preview
                  </a>
                </Button>
                <Button size="sm" variant="ghost" onClick={() => {
                  deleteForm.mutate(form.FormID)
                  toast.success('Form deactivated')
                }}>
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Create PublicFormPage**

Write `frontend/src/pages/PublicFormPage.tsx`:
```tsx
import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { api } from '../lib/api'
import { Button } from '../components/ui/button'
import { Input } from '../components/ui/input'
import { Label } from '../components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select'
import { Card, CardContent } from '../components/ui/card'
import { GraduationCap, CheckCircle } from 'lucide-react'
import { toast } from 'sonner'

const formSchema = z.object({
  fullName: z.string().min(1, 'Full name is required'),
  email: z.string().email('Valid email is required'),
  passport: z.string().min(1, 'Passport number is required'),
  nationality: z.string().optional(),
  structure: z.enum(['Research', 'Mixed Mode', 'Coursework']),
  programme: z.string().min(1, 'Programme is required'),
  campaign: z.string().optional(),
})

type FormValues = z.infer<typeof formSchema>

export default function PublicFormPage() {
  const { agentId, formId } = useParams()
  const [submitted, setSubmitted] = useState(false)
  const [appId, setAppId] = useState('')

  const { register, handleSubmit, formState: { errors, isSubmitting }, setValue, watch } = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: { structure: 'Research' },
  })

  const structure = watch('structure')

  const onSubmit = async (data: FormValues) => {
    try {
      const res = await api.post('/leads', {
        ...data,
        agentId,
        formId,
      })
      setAppId(res.data.applicationId)
      setSubmitted(true)
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Submission failed. Please try again.')
    }
  }

  if (submitted) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="w-full max-w-md bg-surface border-border text-center">
          <CardContent className="p-8">
            <CheckCircle className="w-12 h-12 text-success mx-auto mb-4" />
            <h1 className="text-xl font-bold text-foreground mb-2">Application Submitted!</h1>
            <p className="text-muted mb-2">Your Application ID: <span className="font-mono font-bold text-foreground">{appId}</span></p>
            <p className="text-sm text-muted">Check your email for the conditional offer letter.</p>
            <Button className="mt-6" onClick={() => window.location.reload()}>Submit Another</Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center py-10 px-4">
      <Card className="w-full max-w-lg bg-surface border-border">
        <CardContent className="p-8">
          <div className="text-center mb-6">
            <GraduationCap className="w-10 h-10 text-primary mx-auto mb-2" />
            <h1 className="text-xl font-bold text-foreground">UniSZA Postgraduate Application</h1>
            <p className="text-sm text-muted mt-1">Fill in your details to receive a conditional offer</p>
          </div>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div>
              <Label htmlFor="fullName">Full Name (as in Passport)</Label>
              <Input id="fullName" {...register('fullName')} />
              {errors.fullName && <p className="text-danger text-xs mt-1">{errors.fullName.message}</p>}
            </div>

            <div>
              <Label htmlFor="email">Email Address</Label>
              <Input id="email" type="email" {...register('email')} />
              {errors.email && <p className="text-danger text-xs mt-1">{errors.email.message}</p>}
            </div>

            <div>
              <Label htmlFor="passport">Passport Number</Label>
              <Input id="passport" {...register('passport')} />
              {errors.passport && <p className="text-danger text-xs mt-1">{errors.passport.message}</p>}
            </div>

            <div>
              <Label htmlFor="nationality">Nationality</Label>
              <Input id="nationality" {...register('nationality')} />
            </div>

            <div>
              <Label>Structure</Label>
              <Select value={structure} onValueChange={v => setValue('structure', v as any)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Research">Research</SelectItem>
                  <SelectItem value="Mixed Mode">Mixed Mode</SelectItem>
                  <SelectItem value="Coursework">Coursework</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="programme">Programme</Label>
              <Input id="programme" {...register('programme')} placeholder="e.g., Master of Science (Computer Science)" />
              {errors.programme && <p className="text-danger text-xs mt-1">{errors.programme.message}</p>}
            </div>

            <div>
              <Label htmlFor="campaign">How did you hear about us?</Label>
              <Input id="campaign" {...register('campaign')} placeholder="e.g., UGS Tour Location" />
            </div>

            <Button type="submit" className="w-full" disabled={isSubmitting}>
              {isSubmitting ? 'Submitting...' : 'Submit Application'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
```

- [ ] **Step 3: Create FormsPage**

Write `frontend/src/pages/FormsPage.tsx`:
```tsx
import { FormManager } from '../components/forms/FormManager'

export default function FormsPage() {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-foreground">My Forms</h1>
      <FormManager />
    </div>
  )
}
```

- [ ] **Step 4: Verify TypeScript compiles**

```bash
cd frontend && npx tsc --noEmit
```

- [ ] **Step 5: Commit**

```bash
git add frontend/src/pages/FormsPage.tsx frontend/src/pages/PublicFormPage.tsx frontend/src/components/forms/
git commit -m "feat: add forms manager and public form page"
```

---

### Task 16: Backend Environment Template + Integration Verification

**Files:**
- Create: `backend/.env.example`
- Create: `README.md` (project setup instructions)

**Interfaces:**
- Produces:
  - `.env.example` with all required variables documented
  - README with setup instructions

- [ ] **Step 1: Create backend env template**

Write `backend/.env.example`:
```
PORT=8080
NODE_ENV=development
GOOGLE_CLIENT_ID=your-google-client-id.apps.googleusercontent.com
JWT_SECRET=a-random-secret-string-at-least-32-chars
SPREADSHEET_ID=your-google-sheets-spreadsheet-id
OFFER_TEMPLATE_DOC_ID=your-google-doc-template-id
OFFER_OUTPUT_FOLDER_ID=your-google-drive-folder-id
GMAIL_USER=your-email@unisza.edu.my
GOOGLE_SERVICE_ACCOUNT_EMAIL=service-account@project.iam.gserviceaccount.com
GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
FRONTEND_URL=http://localhost:3000
```

- [ ] **Step 2: Create README**

Rewrite `README.md`:
```md
# UGS Agent Tracking & Student Pipeline

Web application for UniSZA Graduate School to monitor agent promotional activities, generate conditional offer letters, and track international student registration progress.

## Prerequisites

- Node.js >= 20 LTS
- Google Cloud Project with the following APIs enabled:
  - Google Sheets API
  - Google Drive API
  - Google Docs API
  - Gmail API
- Google OAuth 2.0 Client ID (Web application)
- Google Service Account with domain-wide delegation

## Setup

1. Clone the repository
2. Backend: `cd backend && cp .env.example .env` and fill in your credentials
3. Backend: `cd backend && npm install && npm run dev`
4. Frontend: `cd frontend && npm install && npm run dev`

## Environment Variables

See `backend/.env.example` for all required variables.

## Sheets Structure

The app expects a Google Spreadsheet with sheets (tabs) named:
- `Agents` — columns: AgentID, Name, Email, Role, Status, FormsAssigned, CreatedAt
- `Leads` — columns auto-created by the app
- `Forms` — columns auto-created by the app

The `Agents` sheet must exist with at least one admin user (Email matching a Google account).
```

- [ ] **Step 3: Verify full project compiles**

```bash
cd backend && npx tsc --noEmit
cd ../frontend && npx tsc --noEmit
```
Expected: No errors in either project.

- [ ] **Step 4: Commit**

```bash
git add backend/.env.example README.md
git commit -m "docs: add environment template and project README"
```

---

### Task 17: Final Integration — Start-to-Finish Wiring Check

**Files:**
- Modify: `frontend/vite.config.ts` (ensure proxy is correct)
- Verify: All routes registered in `backend/src/app.ts`

**Steps:**

- [ ] **Step 1: Verify backend routes are all registered**

Read `backend/src/app.ts` and confirm these routes are registered:
```
/api/health
/api/auth/google, /api/auth/me, /api/auth/logout
/api/agents
/api/leads
/api/forms
/api/dashboard/summary
```

- [ ] **Step 2: Start backend and test health endpoint**

```bash
cd backend && npm run dev &
sleep 3
curl http://localhost:8080/api/health
```
Expected: `{"status":"ok","timestamp":"..."}`

- [ ] **Step 3: Start frontend and verify it proxies**

```bash
cd frontend && npm run dev &
sleep 5
# Verify frontend loads at http://localhost:3000
```

- [ ] **Step 4: Verify public form route loads**

Open in browser: `http://localhost:3000/form/test-agent/test-form`
Expected: Public form page renders with UniSZA branding and form fields.

- [ ] **Step 5: Verify login page loads**

Open: `http://localhost:3000/login`
Expected: Login page with Google sign-in button.

- [ ] **Step 6: Commit any fixes**

```bash
git add -A
git commit -m "chore: final integration fixes and wiring"
```
