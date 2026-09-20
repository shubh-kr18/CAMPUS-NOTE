import { getOllamaConfig, isOllamaConnectionError, createOllamaConnectionError } from '../config/env.js'

export const EMBEDDING_MODEL = process.env.OLLAMA_EMBEDDING_MODEL || 'nomic-embed-text'
export const EMBEDDING_DIMENSIONS = 768

// Max chunks to embed per request
const BATCH_SIZE = 50

// Retry configuration
const MAX_RETRIES = 3
const INITIAL_RETRY_DELAY_MS = 1000

/**
 * Sleep helper for retry delay.
 */
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms))

/**
 * Calls local Ollama /api/embed API with exponential backoff retry for transient errors.
 *
 * @param {string[]} texts - Array of chunk text strings to embed.
 * @param {number} [attempt=1]
 * @returns {Promise<number[][]>} Array of embedding vectors.
 */
async function callEmbeddingApiWithRetry(texts, attempt = 1) {
  const { baseUrl, embeddingModel } = getOllamaConfig()

  try {
    const response = await fetch(`${baseUrl}/api/embed`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: embeddingModel,
        input: texts
      })
    })

    if (!response.ok) {
      const errorText = await response.text().catch(() => '')
      const error = new Error(`Ollama embedding error (${response.status}): ${errorText || response.statusText}`)
      error.status = response.status
      if (isOllamaConnectionError(error)) {
        throw createOllamaConnectionError(error)
      }
      throw error
    }

    const data = await response.json()
    if (!data.embeddings || !Array.isArray(data.embeddings)) {
      throw new Error('Malformed embedding response from Ollama.')
    }

    return data.embeddings
  } catch (error) {
    if (isOllamaConnectionError(error)) {
      throw createOllamaConnectionError(error)
    }

    const isRetryable =
      error.status === 429 ||
      (error.status >= 500 && error.status < 600) ||
      error.code === 'ECONNRESET' ||
      error.code === 'ETIMEDOUT'

    if (isRetryable && attempt < MAX_RETRIES) {
      const delay = INITIAL_RETRY_DELAY_MS * Math.pow(2, attempt - 1) + Math.random() * 200
      console.warn(`[EmbeddingService] Ollama call failed (${error.message}). Retrying in ${Math.round(delay)}ms (attempt ${attempt}/${MAX_RETRIES})...`)
      await sleep(delay)
      return callEmbeddingApiWithRetry(texts, attempt + 1)
    }

    throw error
  }
}

/**
 * Generates embeddings for an array of texts.
 * Automatically batches large input lists into chunks of up to BATCH_SIZE
 * to stay within API limits while minimizing network roundtrips.
 *
 * @param {string[]} texts - Array of text strings.
 * @returns {Promise<number[][]>} Array of embedding vectors (768-dimensional).
 */
export async function generateEmbeddings(texts) {
  if (!texts || texts.length === 0) return []

  const allEmbeddings = []

  for (let i = 0; i < texts.length; i += BATCH_SIZE) {
    const batch = texts.slice(i, i + BATCH_SIZE)
    const batchEmbeddings = await callEmbeddingApiWithRetry(batch)
    allEmbeddings.push(...batchEmbeddings)
  }

  return allEmbeddings
}

/**
 * Generates an embedding for a user query or question using the same model.
 *
 * @param {string} question - Question string to embed.
 * @returns {Promise<number[]>} 768-dimensional embedding vector.
 */
export async function generateQuestionEmbedding(question) {
  if (!question || typeof question !== 'string' || !question.trim()) {
    throw new Error('Question must be a non-empty string.')
  }
  const [embedding] = await generateEmbeddings([question.trim()])
  return embedding
}
