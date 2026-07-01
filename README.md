# UGS Agent Tracking & Student Pipeline

Web application for UniSZA Graduate School to monitor agent promotional activities,
generate conditional offer letters, and track international student registration progress.

## Architecture

```
ggn-agent-tracking/
├── backend/              Express + TypeScript REST API
│   └── src/
│       ├── routes/        auth, agents, leads, forms, dashboard
│       ├── services/      sheets, drive, docs, gmail, offerLetter
│       ├── middleware/     JWT auth + role-based authorization
│       └── utils/         error classes, helpers
└── frontend/             React + Vite + Tailwind SPA
    └── src/              Google OAuth login, agent/lead/form dashboards
```

- **Backend** — Express 4 server with JWT cookie auth. All persistent data lives in
  a single Google Spreadsheet. Google APIs (Sheets, Drive, Docs, Gmail) are called
  via a service account.
- **Frontend** — React 19 SPA with React Router, TanStack Query, and shadcn/ui
  components. Login uses Google OAuth 2.0 (implicit flow, verified on the backend).
- **No database** — the spreadsheet serves as the only data store. Agents, leads,
  and forms each have a dedicated sheet (tab).

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

```bash
# 1. Clone the repository
git clone <repo-url> && cd ggn-agent-tracking

# 2. Configure backend environment
cp backend/.env.example backend/.env
# Edit backend/.env with your Google credentials and spreadsheet IDs

# 3. Install and start backend
cd backend && npm install && npm run dev

# 4. In another terminal, install and start frontend
cd frontend && npm install && npm run dev
```

The backend runs on `http://localhost:8080` and the frontend on `http://localhost:5173`.

## Environment Variables

All required variables are documented in `backend/.env.example`.

| Variable | Description |
|---|---|
| `PORT` | Backend listen port (default: 8080) |
| `NODE_ENV` | `development` or `production` |
| `GOOGLE_CLIENT_ID` | OAuth 2.0 client ID from Google Cloud Console |
| `JWT_SECRET` | Random secret for signing auth tokens (min 32 chars) |
| `SPREADSHEET_ID` | Google Sheets spreadsheet ID |
| `OFFER_TEMPLATE_DOC_ID` | Google Doc ID used as offer letter template |
| `OFFER_OUTPUT_FOLDER_ID` | Google Drive folder ID for generated offer letters |
| `GMAIL_USER` | Email address offer letters are sent from |
| `GOOGLE_SERVICE_ACCOUNT_EMAIL` | Service account email |
| `GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY` | Service account private key (PEM) |
| `FRONTEND_URL` | CORS origin (default: `http://localhost:3000`) |

## Sheets Structure

The app expects a Google Spreadsheet with the following sheets (tabs):

| Sheet | Contents |
|---|---|
| `Agents` | Pre-seeded. Columns: AgentID, Name, Email, Role, Status, FormsAssigned, CreatedAt |
| `Leads` | Auto-created. Columns managed by the app. |
| `Forms` | Auto-created. Columns managed by the app. |

The `Agents` sheet must exist with at least one admin user (Email matching a Google
account that will log in).

## Scripts

### Backend

| Script | Description |
|---|---|
| `npm run dev` | Start development server with hot reload (tsx) |
| `npm run build` | Compile TypeScript to `dist/` |
| `npm start` | Run compiled production build |
| `npm test` | Run Vitest test suite |

### Frontend

| Script | Description |
|---|---|
| `npm run dev` | Start Vite dev server |
| `npm run build` | Type-check and build for production |
| `npm run preview` | Preview production build locally |
| `npm run lint` | Run oxlint |

## Deployment

### Backend (Docker)

```bash
cd backend
npm run build
docker build -t ugs-backend .
docker run -d -p 8080:8080 --env-file .env ugs-backend
```

### Frontend (Static)

```bash
cd frontend
npm run build
# Serve dist/ with any static server (nginx, Vercel, Cloudflare Pages, etc.)
```

Set the frontend `.env` variable:
```
VITE_GOOGLE_CLIENT_ID=your-google-client-id.apps.googleusercontent.com
```

Ensure the backend `FRONTEND_URL` matches the deployed frontend origin for CORS.
