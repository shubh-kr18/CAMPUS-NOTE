import { BaseLlmProvider } from './baseProvider.js'
import {
  getOllamaConfig,
  isOllamaConnectionError,
  createOllamaConnectionError
} from '../../config/env.js'

const DEFAULT_CHAT_MODEL = 'llama3.2'

export class OllamaLlmProvider extends BaseLlmProvider {
  constructor() {
    super('ollama')
  }

  /**
   * Calls Ollama /api/chat endpoint using llama3.2 (or configured OLLAMA_MODEL).
   *
   * @param {Object} params
   * @param {string} params.systemPrompt
   * @param {string} params.userPrompt
   * @param {number} [params.temperature=0.0]
   * @param {string} [params.model]
   * @returns {Promise<string>}
   */
  async generateChatCompletion({ systemPrompt, userPrompt, temperature = 0.0, model }) {
    const { baseUrl, model: configuredModel } = getOllamaConfig()
    const chatModel = model || configuredModel || DEFAULT_CHAT_MODEL

    let response
    try {
      response = await fetch(`${baseUrl}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: chatModel,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt }
          ],
          stream: false,
          options: {
            temperature
          }
        })
      })
    } catch (fetchError) {
      if (isOllamaConnectionError(fetchError)) {
        throw createOllamaConnectionError(fetchError)
      }
      throw fetchError
    }

    if (!response.ok) {
      const errText = await response.text().catch(() => '')
      const error = new Error(`Ollama chat error (${response.status}): ${errText || response.statusText}`)
      error.status = response.status
      if (isOllamaConnectionError(error)) {
        throw createOllamaConnectionError(error)
      }
      throw error
    }

    const data = await response.json()
    return data.message?.content?.trim() || ''
  }

  /**
   * Checks whether Ollama is running and has the llama3.2 model available.
   *
   * @returns {Promise<{ isReady: boolean, ollamaReady: boolean, provider: string, baseUrl: string, chatModel: string }>}
   */
  async checkStatus() {
    const { baseUrl, model } = getOllamaConfig()
    const chatModel = model || DEFAULT_CHAT_MODEL
    let ollamaReady = false

    try {
      const checkRes = await fetch(`${baseUrl}/api/tags`, { signal: AbortSignal.timeout(3000) })
      if (checkRes.ok) {
        const data = await checkRes.json()
        const models = (data.models || []).map(m => m.name)
        ollamaReady = models.some(m => m.includes(chatModel))
      }
    } catch {
      ollamaReady = false
    }

    return {
      isReady: ollamaReady,
      ollamaReady,
      provider: 'ollama',
      baseUrl,
      chatModel
    }
  }
}

// Backward-compatibility alias
export const OllamaProvider = OllamaLlmProvider
