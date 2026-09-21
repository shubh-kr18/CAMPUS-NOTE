import { BaseEmbeddingProvider } from './baseEmbeddingProvider.js'
import {
  getOllamaConfig,
  isOllamaConnectionError,
  createOllamaConnectionError
} from '../../config/env.js'

export const DEFAULT_OLLAMA_EMBEDDING_MODEL = 'nomic-embed-text'
export const OLLAMA_EMBEDDING_DIMENSIONS = 768

const MAX_RETRIES = 3
const INITIAL_RETRY_DELAY_MS = 1000

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms))

/**
 * Ollama Embedding Provider using nomic-embed-text.
 */
export class OllamaEmbeddingProvider extends BaseEmbeddingProvider {
  constructor() {
    super('ollama')
    this.dimensions = OLLAMA_EMBEDDING_DIMENSIONS
  }

  get model() {
    return getOllamaConfig().embeddingModel || DEFAULT_OLLAMA_EMBEDDING_MODEL
  }

  /**
   * Internal helper with exponential backoff retry.
   */
  async _callEmbeddingApiWithRetry(texts, attempt = 1) {
    const { baseUrl, embeddingModel } = getOllamaConfig()
    const targetModel = embeddingModel || DEFAULT_OLLAMA_EMBEDDING_MODEL

    try {
      const response = await fetch(`${baseUrl}/api/embed`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: targetModel,
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
        console.warn(`[OllamaEmbeddingProvider] Ollama call failed (${error.message}). Retrying in ${Math.round(delay)}ms (attempt ${attempt}/${MAX_RETRIES})...`)
        await sleep(delay)
        return this._callEmbeddingApiWithRetry(texts, attempt + 1)
      }

      throw error
    }
  }

  /**
   * Generates embedding vectors for an array of texts.
   *
   * @param {string[]} texts
   * @returns {Promise<number[][]>}
   */
  async generateEmbeddings(texts) {
    if (!texts || texts.length === 0) return []
    return this._callEmbeddingApiWithRetry(texts)
  }

  /**
   * Checks whether Ollama is running and has nomic-embed-text available.
   *
   * @returns {Promise<{ isReady: boolean, provider: string, model: string, dimensions: number }>}
   */
  async checkStatus() {
    const { baseUrl, embeddingModel } = getOllamaConfig()
    const targetModel = embeddingModel || DEFAULT_OLLAMA_EMBEDDING_MODEL
    let isReady = false

    try {
      const checkRes = await fetch(`${baseUrl}/api/tags`, { signal: AbortSignal.timeout(3000) })
      if (checkRes.ok) {
        const data = await checkRes.json()
        const models = (data.models || []).map(m => m.name)
        isReady = models.some(m => m.includes(targetModel))
      }
    } catch {
      isReady = false
    }

    return {
      isReady,
      provider: 'ollama',
      model: targetModel,
      dimensions: this.dimensions
    }
  }
}
