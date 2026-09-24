import { getAiProviderConfig, getEmbeddingProviderConfig } from '../../config/env.js'
import { BaseLlmProvider, BaseAiProvider } from './baseProvider.js'
import { OllamaLlmProvider, OllamaProvider } from './ollamaProvider.js'
import { GeminiLlmProvider, GeminiProvider } from '../geminiProvider.js'
import { BaseEmbeddingProvider } from './baseEmbeddingProvider.js'
import { OllamaEmbeddingProvider } from './ollamaEmbeddingProvider.js'
import { GeminiEmbeddingProvider, GeminiEmbedding } from '../geminiEmbeddingProvider.js'

// Singleton instances
const llmInstances = {
  ollama: null,
  gemini: null
}

const embeddingInstances = {
  ollama: null,
  gemini: null
}

/**
 * Returns the active LLM Provider instance based on AI_PROVIDER environment variable
 * or optional override ('ollama' by default).
 *
 * Supported providers: 'ollama', 'gemini'
 *
 * @param {string} [providerName]
 * @returns {BaseLlmProvider}
 */
export function getLlmProvider(providerName) {
  const selectedProvider = (providerName || getAiProviderConfig().provider || 'ollama').toLowerCase().trim()

  switch (selectedProvider) {
    case 'ollama':
      if (!llmInstances.ollama) {
        llmInstances.ollama = new OllamaLlmProvider()
      }
      return llmInstances.ollama

    case 'gemini':
      if (!llmInstances.gemini) {
        llmInstances.gemini = new GeminiLlmProvider()
      }
      return llmInstances.gemini

    default:
      throw new Error(
        `Unsupported AI_PROVIDER: "${selectedProvider}". Supported LLM providers are: "ollama", "gemini".`
      )
  }
}

/**
 * Returns the active Embedding Provider instance based on EMBEDDING_PROVIDER
 * or AI_PROVIDER environment variables ('ollama' by default).
 *
 * Supported providers: 'ollama', 'gemini'
 *
 * @param {string} [providerName]
 * @returns {BaseEmbeddingProvider}
 */
export function getEmbeddingProvider(providerName) {
  const selectedProvider = (providerName || getEmbeddingProviderConfig().provider || 'ollama').toLowerCase().trim()

  switch (selectedProvider) {
    case 'ollama':
      if (!embeddingInstances.ollama) {
        embeddingInstances.ollama = new OllamaEmbeddingProvider()
      }
      return embeddingInstances.ollama

    case 'gemini':
      if (!embeddingInstances.gemini) {
        embeddingInstances.gemini = new GeminiEmbeddingProvider()
      }
      return embeddingInstances.gemini

    default:
      throw new Error(
        `Unsupported EMBEDDING_PROVIDER: "${selectedProvider}". Supported embedding providers are: "ollama", "gemini".`
      )
  }
}

// Backward-compatibility aliases
export const getAiProvider = getLlmProvider

export {
  BaseLlmProvider,
  BaseAiProvider,
  OllamaLlmProvider,
  OllamaProvider,
  GeminiLlmProvider,
  GeminiProvider,
  BaseEmbeddingProvider,
  OllamaEmbeddingProvider,
  GeminiEmbeddingProvider,
  GeminiEmbedding
}
