# UGS Agent Tracking & Student Pipeline — Design Specification

**Date:** 2026-07-01
**Version:** 1.0

## 1. Overview

A web application for UniSZA Graduate School (UGS) to:
- Monitor promotional activities by agents (e.g., UniSZA Consultancy Sdn. Bhd., individual agents)
- Generate and send conditional offer letters to prospective students
- Track international student registration progress through a visual pipeline
- Record all data in Google Sheets for UGS follow-up

**Users:** Agents (create leads, manage pipeline), UGS Admins (oversee all, manage agents)
**Delivery:** 3 phases

## 2. Technology Stack

| Layer | Technology | Rationale |
|-------|-----------|-----------|
| Frontend | React 19 + Vite + TypeScript | Fast SPA, great DX |
| UI Library | shadcn/ui + Tailwind CSS v4 | Accessible, dark/light theme |
| Charts | Recharts | Pipeline & analytics charts |
| Icons | Lucide React | Consistent icon set |
| Forms | React Hook Form + Zod | Validation |
| Tables | TanStack Table | Sort/filter/paginate |
| Backend | Express.js (Node.js) on Cloud Run | Serverless, scales to zero |
| Auth | Google OAuth 2.0 (server-side) | No password management |
| Session | JWT in HTTP-only cookie | Secure, XSS-resistant |
| Data Store | Google Sheets API v4 | Existing workflow preserved |
| Docs/PDF | Google Docs API + Drive API | Template-based offer letters |
| Email | Gmail API (UniSZA workspace) | Official domain, trusted |
| File Storage | Google Drive (per student folder) | Accessible to UGS |
| Hosting | Firebase Hosting (frontend) + Cloud Run (backend) | Google ecosystem |

## 3. Google Sheets Data Model

### Sheet: `Agents`
| Column | Type | Description |
|--------|------|-------------|
| AgentID | String | Unique ID (e.g., AGT001) |
| Name | String | Full name |
| Email | String | Google account email (used for login) |
| Role | String | `agent` or `admin` |
| Status | String | `active`, `suspended`, `inactive` |
| FormsAssigned | String | Comma-separated FormIDs |
| CreatedAt | Date | When added |

### Sheet: `Leads` (extends existing form responses)
| Column | Type | Description |
|--------|------|-------------|
| ApplicationID | String | YYYYMMDD-NNN (auto-generated) |
| Timestamp | DateTime | Form submission time |
| FullName | String | As per passport |
| Email | String | Candidate email |
| Passport | String | Passport number |
| Nationality | String | Country |
| Structure | String | Research / Mixed Mode / Coursework |
| Programme | String | Full programme name |
| ProgrammeLevel | String | M or PHD |
| Campaign | String | Tour location / source |
| AgentID | String | Which agent submitted |
| AgentName | String | Agent display name |
| FormID | String | Which form was used |
| Status | String | `New Lead` → `Offer Sent` → `Accepted` → `Enrolled` / `Declined` |
| OfferPDF | String | Drive URL to generated PDF |
| Notes | String | Free text |

### Sheet: `Progress`
| Column | Type | Description |
|--------|------|-------------|
| ApplicationID | String | Links to Leads sheet |
| FullName | String | |
| Passport | String | |
| Programme | String | |
| AgentID | String | |
| Stage1_Entered | DateTime | When stage 1 was reached |
| Stage2_Entered | DateTime | When stage 2 was reached |
| Stage3_Entered | DateTime | etc. |
| Stage4_Entered | DateTime | |
| Stage5_Entered | DateTime | |
| Stage6_Entered | DateTime | |
| Stage7_Entered | DateTime | |
| Stage8_Entered | DateTime | |
| CurrentStage | Number | 1-8 |
| VisaStatus | String | Pending / Processing / Approved |
| EMGSStatus | String | Pending / Processing / Approved |
| DocumentStatus | String | Incomplete / Complete |
| OfficialOfferSent | Boolean | |
| Registered | Boolean | |
| Notes | String | Per-stage notes (JSON blob) |
| LastUpdated | DateTime | |

### Sheet: `Forms`
| Column | Type | Description |
|--------|------|-------------|
| FormID | String | Unique form ID |
| FormName | String | Display name |
| AgentID | String | Owner |
| PublicURL | String | Shareable link |
| EnabledFields | String | JSON array of field names that are active |
| Active | Boolean | On/off toggle |
| CreatedAt | Date | |

## 4. Authentication & Authorization

- **OAuth Provider:** Google Identity Services (`@react-oauth/google`)
- **Flow:** User clicks "Sign in with Google" → popup → Google returns ID token → backend verifies via `google-auth-library` → looks up email in Agents sheet → returns JWT in HTTP-only cookie
- **Agent Whitelist:** Only emails in `Agents` sheet with `status=active` can access
- **Role-Based Access:**
  - `agent`: Can only see/edit their own leads, students, forms
  - `admin`: Full access to all data. Can impersonate any agent's view.
- **Admin Impersonation:** Admin selects an agent from dropdown → API adds `impersonatedAgentId` to JWT claims → all subsequent queries are scoped to that agent

## 5. Phase 1 — Agent Management, Forms & Conditional Offers

### 5.1 Form Builder & Sharing
- Admin or Agent can create a form (name, description)
- Agent toggles which fields appear (from preset pool of standard fields)
- System generates a unique public URL: `https://ugs.unisza.edu.my/form/{agentId}/{formId}`
- Agent copies the link and shares it with prospective students
- Public form page: branded, responsive, validates fields, submits to backend

### 5.2 Lead Submission Flow
1. Candidate fills form → POST `/api/leads`
2. Backend validates, generates Application ID (`YYYYMMDD-NNN` format, counting today's submissions)
3. Saves row to `Leads` sheet with `Status = "New Lead"`
4. Generates conditional offer letter:
   - Copies template Google Doc by ID
   - Replaces `{{Reference}}`, `{{Date}}`, `{{Name}}`, `{{Passport}}`, `{{Email}}`, `{{Programme}}`, `{{Structure}}`
   - Exports as PDF → saves to Drive folder
   - Deletes temp Google Doc
5. Sends email via Gmail API with PDF attachment
6. Updates Leads row: `Status = "Offer Sent"`, `OfferPDF` = Drive URL
7. Returns success to frontend

### 5.3 Agent Dashboard (Phase 1)
- Summary cards: Total Leads, Offers Sent, Acceptances, Conversion Rate
- Leads table with search, sort, filter by status/date
- "View Offer" button → opens PDF from Drive URL
- "Resend Offer" button (manual retry if email bounced)

### 5.4 Admin Dashboard (Phase 1)
- All-agent overview table with leads and offer counts per agent
- All leads view with agent filter
- Manual offer re-generation capability
- Agent impersonation mode

## 6. Phase 2 — Student Progress Pipeline

### 6.1 Pipeline Stages
| Stage | Name | Agent Action |
|-------|------|-------------|
| 1 | Conditional Offer Accepted | Agent clicks "Accept" on a lead → moves student to pipeline |
| 2 | Document Collection | Upload passport, transcripts, health report, photo, etc. |
| 3 | Documents → International School | Click "Submitted" — documents sent to IS UniSZA |
| 4 | EMGS Processing | System waits / agent updates when EMGS status changes |
| 5 | Immigration Processing | EMGS forwards to Immigration Dept |
| 6 | Visa Approved (eVAL) | eVAL received |
| 7 | Official Offer Letter Issued | UGS issues → generates official offer (same template as conditional for now) |
| 8 | Registered | Student completes enrollment |

### 6.2 Progress Bar UI
- Visual stepper showing 8 stages
- **Gray** = pending, **Blue** = in-progress, **Green** = complete, **Red** = bottleneck (>14 days)
- Each stage shows: days elapsed, agent who advanced, timestamp
- Click stage to: upload docs, add notes, mark complete, revert (admin only)
- Agent clicks "Advance to Next Stage" → timestamp recorded, `CurrentStage` incremented

### 6.3 Document Upload
- Upload via POST `/api/pipeline/:appId/upload`
- Files saved to Google Drive: `/{RootFolder}/{ApplicationID}/{StageName}/`
- Drive file URL stored in Progress sheet notes

### 6.4 Bottleneck Detection
- System calculates days since entering each stage
- Students stuck >14 days in any incomplete stage → flagged red
- Admin sees "Bottleneck Alert" section with stuck students
- Agent sees notification: "Student X has been in Stage 4 for 30 days"

## 7. Phase 3 — Admin Dashboard & Analytics

### 7.1 Key Metrics
- **Overview Cards:** Total Leads, Offers Sent, Accepted, Enrolled, Conversion Rate
- Filter by: Agent, Date Range, Programme, Campaign
- **Pipeline Health:** Per-stage student count with average duration, bottleneck flagging
- **Agent Performance:** Table comparing agents by leads, offers, pipeline progress, conversion rate
- **Aging Report:** Average time per stage across all students

### 7.2 Agent Management
- CRUD for agents in the `Agents` sheet via admin UI
- Suspend/reactivate agents
- View agent activity log (all actions timestamped)

### 7.3 Export
- Export any table view to CSV/Excel
- Export pipeline status report

### 7.4 Notifications
- **In-app:** Bell icon with unread count. Dropdown shows recent alerts
- **Email:** Weekly digest to admins (pipeline summary, stuck students)
- **Real-time alerts:** Agent gets notified when admin "nudges" a stuck student
- **Email alerts:** Agent notified via email if student is stuck >14 days

## 8. UI/UX Design

### 8.1 Design Tokens
| Token | Dark Theme | Light Theme |
|-------|-----------|-------------|
| Background | `#0A0A0B` (near-black) | `#FAFAFA` |
| Surface | `#1A1A2E` (deep navy) | `#FFFFFF` |
| Primary | `#4F46E5` (indigo) | `#4F46E5` (indigo) |
| Accent | `#F59E0B` (amber/gold) | `#D97706` |
| Success | `#10B981` (emerald) | `#059669` |
| Danger/Bottleneck | `#EF4444` (red) | `#DC2626` |
| Text Primary | `#E2E8F0` | `#1E293B` |
| Text Secondary | `#94A3B8` | `#64748B` |

### 8.2 Layout Structure
- **Sidebar:** Collapsible navigation (Dashboard, My Leads, Pipeline, My Forms, Students) + admin-only items (All Agents, Settings)
- **Header:** Logo, breadcrumb, theme toggle (moon/sun), notification bell, user avatar/dropdown
- **Main Content:** Scrollable, responsive grid

### 8.3 Key Screens
1. **Login:** Google sign-in button, UniSZA branding
2. **Agent Dashboard:** Summary cards, recent leads table, quick actions
3. **My Leads:** Searchable/filterable table with status badges
4. **Pipeline:** Progress boards grouped by student, drag-down to see stages
5. **Form Manager:** List forms, copy link, toggle fields, deactivate
6. **Public Form:** Branded page, multi-step form with validation
7. **Admin Dashboard:** Pipeline health, agent comparison, bottleneck alerts
8. **Student Detail:** Full timeline, documents, notes, progress bar

### 8.4 Responsive
- Desktop-first (primary use case)
- Mobile: sidebar collapses, tables become cards

## 9. API Endpoints

### Auth
| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/api/auth/google` | Public | Exchange Google token for JWT |
| POST | `/api/auth/logout` | User | Clear session |
| GET | `/api/auth/me` | User | Current user + role |

### Agents (Admin)
| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/agents` | Admin | List all agents |
| POST | `/api/agents` | Admin | Add agent |
| PATCH | `/api/agents/:id` | Admin | Update agent |
| DELETE | `/api/agents/:id` | Admin | Remove agent |

### Leads
| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/leads` | User | List leads (scoped) |
| POST | `/api/leads` | Public* | Submit lead from form (*rate-limited) |
| GET | `/api/leads/:id` | User | Lead detail |
| PATCH | `/api/leads/:id` | User | Update status/notes |
| POST | `/api/leads/:id/generate-offer` | User | Generate & send offer letter |

### Forms
| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/forms` | User | List agent's forms |
| POST | `/api/forms` | User | Create form |
| PATCH | `/api/forms/:id` | User | Update form config |
| DELETE | `/api/forms/:id` | User | Deactivate |

### Pipeline
| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/pipeline` | User | List pipeline students (scoped) |
| GET | `/api/pipeline/:appId` | User | Student progress detail |
| POST | `/api/pipeline/:appId/advance` | User | Advance to next stage |
| POST | `/api/pipeline/:appId/revert` | Admin | Revert stage |
| POST | `/api/pipeline/:appId/upload` | User | Upload document |
| POST | `/api/pipeline/:appId/notes` | User | Add note |

### Dashboard
| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/dashboard/summary` | User | Metrics cards |
| GET | `/api/dashboard/pipeline-health` | User | Pipeline bottleneck report |
| GET | `/api/dashboard/agent-performance` | Admin | Agent comparison |

### Notifications
| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/notifications` | User | In-app notifications |
| PATCH | `/api/notifications/:id/read` | User | Mark read |

### Export
| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/export/leads` | User | Export leads CSV |
| GET | `/api/export/pipeline` | User | Export pipeline CSV |

## 10. Error Handling & Edge Cases

- **Duplicate Application ID:** Lock-based counter prevents race conditions on same-day submission
- **Sheets API quota exceeded:** Backend returns 429, frontend shows retry-after message
- **Email bounce:** Gmail API returns bounce status → logged in Leads sheet, agent can resend
- **Template doc missing:** Clear error message, admin alerted via notification
- **File upload too large:** Limit 10MB per file, validate before upload
- **Invalid form submission:** Zod validation on backend, show field-level errors
- **Session expired:** HTTP 401 → redirect to login, show "Session expired" toast
- **Agent not whitelisted:** Show "Access denied. Contact UGS administrator."
- **Rate limiting:** Public form endpoint rate-limited to 10 req/min per IP

## 11. Phased Delivery Plan

### Phase 1 (MVP)
- Project scaffolding (monorepo: React frontend + Express backend)
- Google OAuth authentication + session management
- Agent CRUD (admin only)
- Form builder + public form page
- Lead submission → Application ID generation
- Google Docs template → PDF generation
- Gmail API email dispatch
- Agent dashboard (leads table, summary cards)
- Admin dashboard (all agents/leads overview)
- Dark/light theme toggle

### Phase 2
- Student progress pipeline (8 stages)
- Progress bar UI with color coding
- Document upload to Google Drive
- Stage advancement/revert
- Bottleneck detection + alerts
- Pipeline dashboard for agents and admins

### Phase 3
- Advanced admin analytics (pipeline health, agent performance)
- Export to CSV/Excel
- In-app notification bell
- Email notifications (weekly digest, nudge reminders)
- Admin impersonation mode
- Activity audit log
- Agent performance reports
