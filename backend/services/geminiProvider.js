import { GoogleGenAI } from '@google/genai'
import { BaseLlmProvider } from './providers/baseProvider.js'
import { getGeminiConfig } from '../config/env.js'

const DEFAULT_GEMINI_MODEL = 'gemini-2.5-flash'
const FALLBACK_GEMINI_MODEL = 'gemini-3.6-flash'
const RETRY_DELAYS_MS = [1000, 2000, 4000]
const MAX_ATTEMPTS = 4

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms))

/**
 * Checks whether an error is a temporary 503 UNAVAILABLE service error.
 * Client errors (400, 401, 403, 404, 429) must never be treated as 503.
 */
function isUnavailableError(error) {
  if (!error) return false

  const status = Number(error.status || error.statusCode || error.code || error.error?.code)
  if (status >= 400 && status < 500) {
    return false
  }

  if (status === 503) {
    return true
  }

  const rawStatus = String(error.status || error.code || error.error?.status || '').toUpperCase()
  if (rawStatus === 'UNAVAILABLE' || rawStatus === '503') {
    return true
  }

  const msg = String(error.message || '').toUpperCase()
  if (
    msg.includes('503') ||
    msg.includes('UNAVAILABLE') ||
    msg.includes('TEMPORARILY UNAVAILABLE') ||
    msg.includes('HIGH DEMAND')
  ) {
    if (
      msg.includes('400') ||
      msg.includes('401') ||
      msg.includes('403') ||
      msg.includes('404') ||
      msg.includes('INVALID_ARGUMENT') ||
      msg.includes('NOT_FOUND')
    ) {
      return false
    }
    return true
  }

  return false
}

/**
 * Executes a generation request with exponential retry for temporary 503 errors.
 */
async function executeWithRetry(fn, modelName) {
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      return await fn(modelName)
    } catch (err) {
      if (!isUnavailableError(err)) {
        throw err
      }

      if (attempt < MAX_ATTEMPTS) {
        const delay = RETRY_DELAYS_MS[attempt - 1]
        console.warn(
          `[GeminiProvider] 503 UNAVAILABLE on model "${modelName}" (attempt ${attempt}/${MAX_ATTEMPTS}). Retrying in ${delay}ms...`
        )
        await sleep(delay)
      } else {
        console.warn(
          `[GeminiProvider] 503 UNAVAILABLE on model "${modelName}" after all ${MAX_ATTEMPTS} attempts.`
        )
        throw err
      }
    }
  }
}

/**
 * Gemini LLM Provider supporting chat completions via official @google/genai SDK.
 */
export class GeminiLlmProvider extends BaseLlmProvider {
  constructor() {
    super('gemini')
    this._client = null
    this._cachedKey = null
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
   * Generates chat completion via Gemini generateContent API with 503 retry and fallback.
   *
   * @param {Object} params
   * @param {string} params.systemPrompt
   * @param {string} params.userPrompt
   * @param {number} [params.temperature=0.0]
   * @param {string} [params.model]
   * @returns {Promise<string>} Generated answer text
   */
  async generateChatCompletion({ systemPrompt, userPrompt, temperature = 0.0, model }) {
    const client = this._getClient()
    const { model: envModel } = getGeminiConfig()
    const primaryModel = model || envModel || DEFAULT_GEMINI_MODEL
    const fallbackModel = FALLBACK_GEMINI_MODEL

    const config = {}
    if (systemPrompt && systemPrompt.trim()) {
      config.systemInstruction = systemPrompt.trim()
    }
    if (typeof temperature === 'number') {
      config.temperature = temperature
    }

    const modelsToTry = primaryModel !== fallbackModel ? [primaryModel, fallbackModel] : [primaryModel]
    let lastError = null

    for (let i = 0; i < modelsToTry.length; i++) {
      const currentModel = modelsToTry[i]
      if (i > 0) {
        console.warn(`[GeminiProvider] Falling back to model "${currentModel}" due to primary model 503 UNAVAILABLE`)
      }

      try {
        const response = await executeWithRetry(async (m) => {
          return await client.models.generateContent({
            model: m,
            contents: userPrompt,
            config
          })
        }, currentModel)

        return response.text?.trim() || ''
      } catch (err) {
        lastError = err
        if (!isUnavailableError(err)) {
          break
        }
      }
    }

    if (lastError) {
      console.error('[GeminiLlmProvider Error]:', lastError.message)

      if (isUnavailableError(lastError)) {
        const serviceError = new Error(
          'Gemini service is temporarily unavailable due to high demand. Please try again in a few moments.'
        )
        serviceError.status = 503
        serviceError.code = 'UNAVAILABLE'
        throw serviceError
      }

      if (
        lastError.status === 401 ||
        lastError.message?.includes('API key not valid') ||
        lastError.message?.includes('API_KEY_INVALID')
      ) {
        const err = new Error('Invalid Gemini API key. Please check your GEMINI_API_KEY configuration.')
        err.status = 401
        throw err
      }

      if (lastError.status === 429 || lastError.message?.includes('RESOURCE_EXHAUSTED')) {
        const err = new Error('Gemini rate limit or quota exceeded. Please check your plan and billing details.')
        err.status = 429
        throw err
      }

      throw lastError
    }

    return ''
  }

  /**
   * Checks whether Gemini provider is configured with credentials.
   *
   * @returns {Promise<{ isReady: boolean, provider: string, configured: boolean, chatModel: string, message?: string }>}
   */
  async checkStatus() {
    const { apiKey, model } = getGeminiConfig()
    const chatModel = model || DEFAULT_GEMINI_MODEL
    const isConfigured = Boolean(apiKey && apiKey.trim())

    return {
      isReady: isConfigured,
      provider: 'gemini',
      configured: isConfigured,
      chatModel,
      message: isConfigured
        ? `Gemini provider is active with model ${chatModel}.`
        : 'Gemini provider requires GEMINI_API_KEY to be set in environment variables.'
    }
  }
}

// Backward-compatibility alias matching provider naming conventions
export const GeminiProvider = GeminiLlmProvider

// Default provider instance and functional exports
const defaultGeminiProviderInstance = new GeminiLlmProvider()

/**
 * Functional export for chat completion
 */
export async function generateChatCompletion(params) {
  return defaultGeminiProviderInstance.generateChatCompletion(params)
}

/**
 * Functional export for status check
 */
export async function checkStatus() {
  return defaultGeminiProviderInstance.checkStatus()
}

export default defaultGeminiProviderInstance
