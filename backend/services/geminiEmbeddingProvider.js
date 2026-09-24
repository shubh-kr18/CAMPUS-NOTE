import { GoogleGenAI } from '@google/genai'
import { BaseEmbeddingProvider } from './providers/baseEmbeddingProvider.js'
import { getGeminiConfig } from '../config/env.js'

export const DEFAULT_GEMINI_EMBEDDING_MODEL = 'text-embedding-004'
export const DEFAULT_GEMINI_EMBEDDING_DIMENSIONS = 768

/**
 * Returns expected embedding dimensions for a Gemini embedding model.
 */
export function getGeminiEmbeddingDimensions(model) {
  if (process.env.GEMINI_EMBEDDING_DIMENSIONS) {
    const custom = parseInt(process.env.GEMINI_EMBEDDING_DIMENSIONS, 10)
    if (!isNaN(custom) && custom > 0) return custom
  }
  return DEFAULT_GEMINI_EMBEDDING_DIMENSIONS
}

/**
 * Gemini Embedding Provider using official @google/genai SDK.
 */
export class GeminiEmbeddingProvider extends BaseEmbeddingProvider {
  constructor() {
    super('gemini')
    this._client = null
    this._cachedKey = null
  }

  get model() {
    return getGeminiConfig().embeddingModel || DEFAULT_GEMINI_EMBEDDING_MODEL
  }

  get dimensions() {
    return getGeminiEmbeddingDimensions(this.model)
  }

  /**
   * Lazily gets or initializes the GoogleGenAI client instance.
   */
  _getClient() {
    const { apiKey } = getGeminiConfig()
    if (!apiKey || !apiKey.trim()) {
      const error = new Error('Gemini API key is missing. Set GEMINI_API_KEY in your environment variables.')
      error.status = 503
      throw error
    }

    if (!this._client || this._cachedKey !== apiKey) {
      this._client = new GoogleGenAI({ apiKey: apiKey.trim() })
      this._cachedKey = apiKey
    }

    return this._client
  }

  /**
   * Generates embedding vectors for an array of texts.
   *
   * @param {string[]} texts - Array of string passages/chunks.
   * @param {Object} [options]
   * @param {string} [options.taskType] - Optional Gemini taskType (e.g. 'RETRIEVAL_DOCUMENT')
   * @param {string} [options.title] - Optional title for document chunks
   * @returns {Promise<number[][]>} Array of numeric embedding vectors
   */
  async generateEmbeddings(texts, options = {}) {
    if (!texts || texts.length === 0) return []

    const client = this._getClient()
    const targetModel = this.model

    const config = {}
    if (options?.taskType) {
      config.taskType = options.taskType
    }
    if (options?.title) {
      config.title = options.title
    }
    if (process.env.GEMINI_EMBEDDING_DIMENSIONS) {
      const customDims = parseInt(process.env.GEMINI_EMBEDDING_DIMENSIONS, 10)
      if (!isNaN(customDims) && customDims > 0) {
        config.outputDimensionality = customDims
      }
    }

    try {
      const response = await client.models.embedContent({
        model: targetModel,
        contents: texts,
        config: Object.keys(config).length > 0 ? config : undefined
      })

      let vectors = []
      if (Array.isArray(response.embeddings)) {
        vectors = response.embeddings.map(item => item?.values || item?.embedding || item)
      } else if (response.embedding) {
        const single = response.embedding.values || response.embedding
        vectors = [single]
      }

      // Ensure every vector is an array of numbers
      return vectors.map(vec => (Array.isArray(vec) ? vec : []))
    } catch (apiError) {
      console.error('[GeminiEmbeddingProvider Error]:', apiError.message)

      if (
        apiError.status === 400 ||
        apiError.status === 401 ||
        apiError.message?.includes('API key not valid') ||
        apiError.message?.includes('API_KEY_INVALID')
      ) {
        const err = new Error('Invalid Gemini API key. Please check your GEMINI_API_KEY configuration.')
        err.status = 401
        throw err
      }

      if (
        apiError.status === 429 ||
        apiError.message?.includes('RESOURCE_EXHAUSTED') ||
        apiError.message?.includes('quota') ||
        apiError.message?.includes('rate limit')
      ) {
        const err = new Error('Gemini rate limit or quota exceeded. Please check your plan and billing details.')
        err.status = 429
        throw err
      }

      throw apiError
    }
  }

  /**
   * Generates a single embedding vector for a query / search question.
   *
   * @param {string} question
   * @param {Object} [options]
   * @returns {Promise<number[]>} Numeric embedding vector
   */
  async generateQuestionEmbedding(question, options = {}) {
    if (!question || typeof question !== 'string' || !question.trim()) {
      throw new Error('Question must be a non-empty string.')
    }

    const embeddings = await this.generateEmbeddings([question.trim()], {
      taskType: 'RETRIEVAL_QUERY',
      ...options
    })

    return embeddings[0] || []
  }

  /**
   * Alias for query embedding generation.
   *
   * @param {string} query
   * @param {Object} [options]
   * @returns {Promise<number[]>}
   */
  async generateQueryEmbedding(query, options = {}) {
    return this.generateQuestionEmbedding(query, options)
  }

  /**
   * Checks whether Gemini embedding provider is configured.
   *
   * @returns {Promise<{ isReady: boolean, provider: string, configured: boolean, model: string, dimensions: number, message?: string }>}
   */
  async checkStatus() {
    const { apiKey } = getGeminiConfig()
    const targetModel = this.model
    const isConfigured = Boolean(apiKey && apiKey.trim())
    const expectedDimensions = this.dimensions

    return {
      isReady: isConfigured,
      provider: 'gemini',
      configured: isConfigured,
      model: targetModel,
      dimensions: expectedDimensions,
      message: isConfigured
        ? `Gemini embedding provider is active with model ${targetModel} (${expectedDimensions} dims).`
        : 'Gemini embedding provider requires GEMINI_API_KEY to be set in environment variables.'
    }
  }
}

// Backward-compatibility alias
export const GeminiEmbedding = GeminiEmbeddingProvider

// Default provider instance and functional exports
const defaultGeminiEmbeddingInstance = new GeminiEmbeddingProvider()

export async function generateEmbeddings(texts, options) {
  return defaultGeminiEmbeddingInstance.generateEmbeddings(texts, options)
}

export async function generateQuestionEmbedding(question, options) {
  return defaultGeminiEmbeddingInstance.generateQuestionEmbedding(question, options)
}

export async function generateQueryEmbedding(query, options) {
  return defaultGeminiEmbeddingInstance.generateQueryEmbedding(query, options)
}

export async function checkStatus() {
  return defaultGeminiEmbeddingInstance.checkStatus()
}

export default defaultGeminiEmbeddingInstance
