/**
 * Small Base Provider abstraction for LLM chat / completions.
 */
export class BaseLlmProvider {
  constructor(name) {
    this.name = name
  }

  /**
   * Generates a chat completion given system and user prompts.
   *
   * @param {Object} params
   * @param {string} params.systemPrompt
   * @param {string} params.userPrompt
   * @param {number} [params.temperature=0.0]
   * @param {string} [params.model]
   * @returns {Promise<string>} Generated text answer
   */
  async generateChatCompletion({ systemPrompt, userPrompt, temperature = 0.0, model }) {
    throw new Error(`generateChatCompletion not implemented for LLM provider "${this.name}".`)
  }

  /**
   * Checks the health and readiness of the LLM provider.
   *
   * @returns {Promise<{ isReady: boolean, provider: string, [key: string]: any }>}
   */
  async checkStatus() {
    throw new Error(`checkStatus not implemented for LLM provider "${this.name}".`)
  }
}

// Backward-compatibility alias
export const BaseAiProvider = BaseLlmProvider
