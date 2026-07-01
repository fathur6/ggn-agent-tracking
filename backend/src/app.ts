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
