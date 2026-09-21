import OpenAI from 'openai'
import { BaseLlmProvider } from './baseProvider.js'
import { getOpenAiConfig } from '../../config/env.js'

const DEFAULT_OPENAI_MODEL = 'gpt-4o-mini'

/**
 * OpenAI LLM Provider supporting chat completions.
 */
export class OpenAiLlmProvider extends BaseLlmProvider {
  constructor() {
    super('openai')
    this._client = null
    this._cachedKey = null
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
   * Generates chat completion via OpenAI Chat Completions API.
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
    const { model: configuredModel } = getOpenAiConfig()
    const chatModel = model || configuredModel || DEFAULT_OPENAI_MODEL

    try {
      const response = await client.chat.completions.create({
        model: chatModel,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        temperature
      })

      return response.choices?.[0]?.message?.content?.trim() || ''
    } catch (apiError) {
      console.error('[OpenAiLlmProvider Error]:', apiError.message)

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
   * Checks whether OpenAI provider is configured with credentials.
   *
   * @returns {Promise<{ isReady: boolean, provider: string, configured: boolean, chatModel: string, message?: string }>}
   */
  async checkStatus() {
    const { apiKey, model } = getOpenAiConfig()
    const chatModel = model || DEFAULT_OPENAI_MODEL
    const isConfigured = Boolean(apiKey && apiKey.trim())

    return {
      isReady: isConfigured,
      provider: 'openai',
      configured: isConfigured,
      chatModel,
      message: isConfigured
        ? `OpenAI provider is active with model ${chatModel}.`
        : 'OpenAI provider requires OPENAI_API_KEY to be set in environment variables.'
    }
  }
}

// Backward-compatibility alias
export const OpenAiProvider = OpenAiLlmProvider
