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
    if (err instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation failed', details: err.issues })
    }
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
    if (err instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation failed', details: err.issues })
    }
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
