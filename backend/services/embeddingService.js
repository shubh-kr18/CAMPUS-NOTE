import { getEmbeddingProvider } from './providers/index.js'

export const EMBEDDING_MODEL = process.env.OLLAMA_EMBEDDING_MODEL || 'nomic-embed-text'
export const EMBEDDING_DIMENSIONS = 768

// Max chunks to embed per request
const BATCH_SIZE = 50

/**
 * Generates embeddings for an array of texts using the active embedding provider.
 * Automatically batches large input lists into chunks of up to BATCH_SIZE
 * to stay within API limits while minimizing network roundtrips.
 *
 * @param {string[]} texts - Array of text strings.
 * @returns {Promise<number[][]>} Array of embedding vectors.
 */
export async function generateEmbeddings(texts) {
  if (!texts || texts.length === 0) return []

  const provider = getEmbeddingProvider()
  const allEmbeddings = []

  for (let i = 0; i < texts.length; i += BATCH_SIZE) {
    const batch = texts.slice(i, i + BATCH_SIZE)
    const batchEmbeddings = await provider.generateEmbeddings(batch)
    allEmbeddings.push(...batchEmbeddings)
  }

  return allEmbeddings
}

/**
 * Generates an embedding for a user query or question using the same model.
 *
 * @param {string} question - Question string to embed.
 * @returns {Promise<number[]>} 768-dimensional embedding vector.
 */
export async function generateQuestionEmbedding(question) {
  if (!question || typeof question !== 'string' || !question.trim()) {
    throw new Error('Question must be a non-empty string.')
  }
  const [embedding] = await generateEmbeddings([question.trim()])
  return embedding
}
