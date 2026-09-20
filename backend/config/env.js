import path from 'path'
import { fileURLToPath } from 'url'
import dotenv from 'dotenv'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

// Load environment variables in prioritized order:
// 1. backend/.env (primary location for backend configuration)
dotenv.config({ path: path.resolve(__dirname, '../.env') })

// 2. Project root .env (if placed at the repository root)
dotenv.config({ path: path.resolve(__dirname, '../../.env') })

// 3. Current working directory .env
dotenv.config()

export const getOllamaConfig = () => ({
  baseUrl: (process.env.OLLAMA_BASE_URL || 'http://localhost:11434').replace(/\/+$/, ''),
  model: process.env.OLLAMA_MODEL || 'llama3.2',
  embeddingModel: process.env.OLLAMA_EMBEDDING_MODEL || 'nomic-embed-text'
})

export const OLLAMA_NOT_RUNNING_MESSAGE = 'Ollama is not running. Start Ollama and try again.'

/**
 * Checks if an error is due to Ollama being unreachable / connection refused.
 */
export function isOllamaConnectionError(error) {
  if (!error) return false
  if (error.isOllamaConnectionError) return true

  const code = error.code || error.cause?.code
  if (['ECONNREFUSED', 'ENOTFOUND', 'EHOSTUNREACH', 'ECONNRESET', 'ETIMEDOUT'].includes(code)) {
    return true
  }

  const causeMessage = error.cause?.message || ''
  const errorMessage = error.message || ''
  const fullMessage = `${errorMessage} ${causeMessage}`.toLowerCase()

  if (
    fullMessage.includes('econnrefused') ||
    fullMessage.includes('fetch failed') ||
    fullMessage.includes('11434') ||
    fullMessage.includes('ollama is not running') ||
    fullMessage.includes('failed to fetch') ||
    fullMessage.includes('connect refused')
  ) {
    return true
  }

  return false
}

/**
 * Creates a clean 503 error for Ollama connection failures.
 */
export function createOllamaConnectionError(cause) {
  const error = new Error(OLLAMA_NOT_RUNNING_MESSAGE)
  error.status = 503
  error.isOllamaConnectionError = true
  if (cause) error.cause = cause
  return error
}
