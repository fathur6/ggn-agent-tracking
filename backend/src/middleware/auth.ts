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
