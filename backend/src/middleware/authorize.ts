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
