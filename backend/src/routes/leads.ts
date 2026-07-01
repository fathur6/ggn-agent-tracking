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

const patchLeadSchema = z.object({
  status: z.string().optional(),
  notes: z.string().optional(),
})

const publicRateLimit = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  message: { error: 'Too many submissions. Please try again later.' },
})

router.post('/', publicRateLimit, async (req, res, next) => {
  try {
    const data = leadSubmitSchema.parse(req.body)

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
    if (err instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation failed', details: err.issues })
    }
    next(err)
  }
})

router.get('/', authMiddleware, async (req, res, next) => {
  try {
    const rows = await sheets.getRows('Leads')
    const headers = rows[0]
    const agentIdCol = headers.indexOf('AgentID')
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

    let rowIndex = -1
    for (let i = 1; i < rows.length; i++) {
      if (rows[i][appIdCol] === req.params.appId) {
        if (req.user?.role === 'agent' && rows[i][agentIdCol] !== req.user?.agentId) {
          throw new AppError(403, 'Access denied')
        }
        rowIndex = i
        break
      }
    }
    if (rowIndex === -1) throw new AppError(404, 'Lead not found')

    const lead: Record<string, string> = {}
    headers.forEach((h, i) => { lead[h] = rows[rowIndex][i] || '' })
    res.json({ lead })
  } catch (err) {
    next(err)
  }
})

router.patch('/:appId', authMiddleware, async (req, res, next) => {
  try {
    const rows = await sheets.getRows('Leads')
    const headers = rows[0]
    const appIdCol = headers.indexOf('ApplicationID')
    const agentIdCol = headers.indexOf('AgentID')
    const statusCol = headers.indexOf('Status')
    const notesCol = headers.indexOf('Notes')

    let rowIndex = -1
    for (let i = 1; i < rows.length; i++) {
      if (rows[i][appIdCol] === req.params.appId) {
        if (req.user?.role === 'agent' && rows[i][agentIdCol] !== req.user?.agentId) {
          throw new AppError(403, 'Access denied')
        }
        rowIndex = i
        break
      }
    }
    if (rowIndex === -1) throw new AppError(404, 'Lead not found')

    const patchData = patchLeadSchema.parse(req.body)

    if (patchData.status) await sheets.updateCell('Leads', rowIndex + 1, statusCol + 1, patchData.status)
    if (patchData.notes !== undefined) await sheets.updateCell('Leads', rowIndex + 1, notesCol + 1, patchData.notes)

    res.json({ success: true })
  } catch (err) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation failed', details: err.issues })
    }
    next(err)
  }
})

export default router
