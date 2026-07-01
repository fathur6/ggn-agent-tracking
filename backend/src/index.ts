import express from 'express'

const app = express()
const port = process.env.PORT || 8080

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok' })
})

app.listen(port, () => {
  console.log(`Server running on port ${port}`)
})
