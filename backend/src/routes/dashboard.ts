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
