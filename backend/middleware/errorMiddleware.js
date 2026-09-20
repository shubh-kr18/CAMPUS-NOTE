import { isOllamaConnectionError, OLLAMA_NOT_RUNNING_MESSAGE } from '../config/env.js'

export function notFound(req, res) {
  res.status(404).json({ message: `Route not found: ${req.originalUrl}` })
}

export function errorHandler(err, req, res, next) {
  console.error(err)

  if (err.name === 'MulterError' && err.code === 'LIMIT_FILE_SIZE') {
    return res.status(400).json({ message: 'PDF files must be 10 MB or smaller.' })
  }
  if (err.code === 11000) {
    return res.status(409).json({ message: 'A PDF with this title already exists for this subject.' })
  }

  // Handle Ollama connection issues cleanly without exposing internal details
  if (isOllamaConnectionError(err) || err.message === OLLAMA_NOT_RUNNING_MESSAGE) {
    return res.status(503).json({ message: OLLAMA_NOT_RUNNING_MESSAGE })
  }

  // Do not expose stack traces or internal errors to frontend
  const status = typeof err.status === 'number' && err.status >= 400 && err.status < 600 ? err.status : 500
  const message = status < 500 ? (err.message || 'Bad request.') : 'Internal server error.'

  res.status(status).json({ message })
}
