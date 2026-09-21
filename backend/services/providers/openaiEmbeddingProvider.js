import OpenAI from 'openai'
import { BaseEmbeddingProvider } from './baseEmbeddingProvider.js'
import { getOpenAiConfig } from '../../config/env.js'

export const DEFAULT_OPENAI_EMBEDDING_MODEL = 'text-embedding-3-small'

/**
 * Returns expected embedding dimensions for an OpenAI embedding model.
 */
export function getOpenAiEmbeddingDimensions(model) {
  if (process.env.OPENAI_EMBEDDING_DIMENSIONS) {
    const custom = parseInt(process.env.OPENAI_EMBEDDING_DIMENSIONS, 10)
    if (!isNaN(custom) && custom > 0) return custom
  }
  if (model?.includes('text-embedding-3-large')) {
    return 3072
  }
  return 1536
}

/**
 * OpenAI Embedding Provider supporting configurable embedding models
 * (e.g. text-embedding-3-small, text-embedding-3-large, text-embedding-ada-002).
 */
export class OpenAiEmbeddingProvider extends BaseEmbeddingProvider {
  constructor() {
    super('openai')
    this._client = null
    this._cachedKey = null
  }

  get model() {
    return getOpenAiConfig().embeddingModel || DEFAULT_OPENAI_EMBEDDING_MODEL
  }

  get dimensions() {
    return getOpenAiEmbeddingDimensions(this.model)
  }

  /**
   * Lazily gets or initializes the OpenAI client instance.
   */
  _getClient() {
    const { apiKey } = getOpenAiConfig()
    if (!apiKey || !apiKey.trim()) {
      const error = new Error('OpenAI API key is missing. Set OPENAI_API_KEY in your environment variables.')
      error.status = 503
      throw error
    }

    if (!this._client || this._cachedKey !== apiKey) {
      this._client = new OpenAI({ apiKey: apiKey.trim() })
      this._cachedKey = apiKey
    }

    return this._client
  }

  /**
   * Generates embeddings for an array of texts via OpenAI Embeddings API.
   *
   * @param {string[]} texts
   * @returns {Promise<number[][]>}
   */
  async generateEmbeddings(texts) {
    if (!texts || texts.length === 0) return []

    const client = this._getClient()
    const targetModel = this.model
    const requestPayload = {
      model: targetModel,
      input: texts
    }

    // Pass custom dimensions if configured and model supports it (text-embedding-3-*)
    if (process.env.OPENAI_EMBEDDING_DIMENSIONS && targetModel.startsWith('text-embedding-3')) {
      const dims = parseInt(process.env.OPENAI_EMBEDDING_DIMENSIONS, 10)
      if (!isNaN(dims) && dims > 0) {
        requestPayload.dimensions = dims
      }
    }

    try {
      const response = await client.embeddings.create(requestPayload)
      return (response.data || []).map(item => item.embedding)
    } catch (apiError) {
      console.error('[OpenAiEmbeddingProvider Error]:', apiError.message)

      if (apiError.status === 401) {
        const err = new Error('Invalid OpenAI API key. Please check your OPENAI_API_KEY configuration.')
        err.status = 401
        throw err
      }

      if (apiError.status === 429) {
        const err = new Error('OpenAI rate limit or quota exceeded. Please check your plan and billing details.')
        err.status = 429
        throw err
      }

      throw apiError
    }
  }

  /**
   * Checks whether OpenAI embedding provider is configured.
   *
   * @returns {Promise<{ isReady: boolean, provider: string, configured: boolean, model: string, dimensions: number, message?: string }>}
   */
  async checkStatus() {
    const { apiKey } = getOpenAiConfig()
    const targetModel = this.model
    const isConfigured = Boolean(apiKey && apiKey.trim())
    const expectedDimensions = this.dimensions

    return {
      isReady: isConfigured,
      provider: 'openai',
      configured: isConfigured,
      model: targetModel,
      dimensions: expectedDimensions,
      message: isConfigured
        ? `OpenAI embedding provider is active with model ${targetModel} (${expectedDimensions} dims).`
        : 'OpenAI embedding provider requires OPENAI_API_KEY to be set in environment variables.'
    }
  }
}
