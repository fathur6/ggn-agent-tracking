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

    let payload
    try {
      const ticket = await googleClient.verifyIdToken({
        idToken: credential,
        audience: config.googleClientId,
      })
      payload = ticket.getPayload()
    } catch {
      throw new AppError(400, 'Invalid Google token')
    }
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
      role: (agentRow[roleCol]?.toLowerCase() === 'admin' ? 'admin' : 'agent') as 'agent' | 'admin',
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
