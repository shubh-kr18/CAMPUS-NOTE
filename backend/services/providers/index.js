import { getAiProviderConfig, getEmbeddingProviderConfig } from '../../config/env.js'
import { BaseLlmProvider, BaseAiProvider } from './baseProvider.js'
import { OllamaLlmProvider, OllamaProvider } from './ollamaProvider.js'
import { OpenAiLlmProvider, OpenAiProvider } from './openaiProvider.js'
import { BaseEmbeddingProvider } from './baseEmbeddingProvider.js'
import { OllamaEmbeddingProvider } from './ollamaEmbeddingProvider.js'
import { OpenAiEmbeddingProvider } from './openaiEmbeddingProvider.js'

// Singleton instances
const llmInstances = {
  ollama: null,
  openai: null
}

const embeddingInstances = {
  ollama: null,
  openai: null
}

/**
 * Returns the active LLM Provider instance based on AI_PROVIDER environment variable
 * or optional override ('ollama' by default).
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

    case 'openai':
      if (!llmInstances.openai) {
        llmInstances.openai = new OpenAiLlmProvider()
      }
      return llmInstances.openai

    default:
      console.warn(`[LLM Provider] Unknown provider "${selectedProvider}", falling back to "ollama".`)
      if (!llmInstances.ollama) {
        llmInstances.ollama = new OllamaLlmProvider()
      }
      return llmInstances.ollama
  }
}

/**
 * Returns the active Embedding Provider instance based on EMBEDDING_PROVIDER
 * or AI_PROVIDER environment variables ('ollama' by default).
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

    case 'openai':
      if (!embeddingInstances.openai) {
        embeddingInstances.openai = new OpenAiEmbeddingProvider()
      }
      return embeddingInstances.openai

    default:
      console.warn(`[Embedding Provider] Unknown provider "${selectedProvider}", falling back to "ollama".`)
      if (!embeddingInstances.ollama) {
        embeddingInstances.ollama = new OllamaEmbeddingProvider()
      }
      return embeddingInstances.ollama
  }
}

// Backward-compatibility aliases
export const getAiProvider = getLlmProvider

export {
  BaseLlmProvider,
  BaseAiProvider,
  OllamaLlmProvider,
  OllamaProvider,
  OpenAiLlmProvider,
  OpenAiProvider,
  BaseEmbeddingProvider,
  OllamaEmbeddingProvider,
  OpenAiEmbeddingProvider
}
