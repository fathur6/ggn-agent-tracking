import { Router } from 'express'
import { authMiddleware } from '../middleware/auth'
import { requireAdmin } from '../middleware/authorize'
import { SheetsService } from '../services/sheets'
import { AppError } from '../utils/errors'
import { z } from 'zod'

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
    if (err instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation failed', details: err.issues })
    }
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
    if (err instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation failed', details: err.issues })
    }
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
