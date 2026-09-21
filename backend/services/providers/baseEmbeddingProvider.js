/**
 * Base abstract Embedding Provider interface.
 */
export class BaseEmbeddingProvider {
  constructor(name) {
    this.name = name
  }

  /**
   * Generates embedding vectors for an array of texts.
   *
   * @param {string[]} texts
   * @returns {Promise<number[][]>} Array of embedding vectors
   */
  async generateEmbeddings(texts) {
    throw new Error(`generateEmbeddings not implemented for provider "${this.name}".`)
  }

  /**
   * Checks the health and readiness of the embedding provider.
   *
   * @returns {Promise<{ isReady: boolean, provider: string, model: string, dimensions?: number, [key: string]: any }>}
   */
  async checkStatus() {
    throw new Error(`checkStatus not implemented for provider "${this.name}".`)
  }
}
