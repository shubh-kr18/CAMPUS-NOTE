import mongoose from 'mongoose'
import AiChunk from '../models/AiChunk.js'
import { generateQuestionEmbedding } from './embeddingService.js'

export const DEFAULT_TOP_K = 5

/**
 * Calculates cosine similarity between two numerical vectors.
 *
 * @param {number[]} vecA
 * @param {number[]} vecB
 * @returns {number} Value between -1.0 and 1.0 (typically 0.0 to 1.0 for normalized text embeddings).
 */
export function cosineSimilarity(vecA, vecB) {
  if (!vecA || !vecB || vecA.length !== vecB.length) return 0

  let dotProduct = 0
  let normA = 0
  let normB = 0

  for (let i = 0; i < vecA.length; i++) {
    dotProduct += vecA[i] * vecB[i]
    normA += vecA[i] * vecA[i]
    normB += vecB[i] * vecB[i]
  }

  if (normA === 0 || normB === 0) return 0
  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB))
}

/**
 * Performs semantic vector search on chunks for a specific document.
 *
 * @param {Object} params
 * @param {string|mongoose.Types.ObjectId} params.documentId - PDF document ID to search within.
 * @param {string} params.question - Search query / question text.
 * @param {number} [params.topK=5] - Number of top chunks to return.
 * @returns {Promise<Array<{ documentId: string, chunkIndex: number, text: string, pageNumber: number, score: number }>>}
 */
export async function searchSimilarChunks({ documentId, question, topK = DEFAULT_TOP_K }) {
  if (!documentId) {
    throw new Error('documentId is required for vector search.')
  }
  if (!question || typeof question !== 'string' || !question.trim()) {
    throw new Error('question must be a non-empty string.')
  }

  const cleanTopK = Math.max(1, parseInt(topK, 10) || DEFAULT_TOP_K)
  const docObjectId = mongoose.Types.ObjectId.isValid(documentId)
    ? new mongoose.Types.ObjectId(documentId)
    : documentId

  // 1. Generate embedding vector for the question using the same Ollama nomic-embed-text model
  const questionEmbedding = await generateQuestionEmbedding(question)

  // 2. Try MongoDB Atlas Vector Search ($vectorSearch) with strict documentId filter
  try {
    const atlasIndex = process.env.ATLAS_VECTOR_INDEX || 'default'
    const atlasPipeline = [
      {
        $vectorSearch: {
          index: atlasIndex,
          path: 'embedding',
          queryVector: questionEmbedding,
          numCandidates: Math.max(cleanTopK * 10, 50),
          limit: cleanTopK,
          filter: {
            documentId: { $eq: docObjectId }
          }
        }
      },
      {
        $project: {
          _id: 0,
          documentId: 1,
          chunkIndex: 1,
          text: 1,
          pageNumber: 1,
          score: { $meta: 'vectorSearchScore' }
        }
      }
    ]

    const atlasResults = await AiChunk.aggregate(atlasPipeline)
    if (atlasResults && atlasResults.length > 0) {
      return atlasResults
    }
  } catch (atlasError) {
    // $vectorSearch is only available on MongoDB Atlas with an index defined.
    // When running on local MongoDB or before Atlas index is created,
    // we fall back seamlessly to in-memory cosine similarity below.
  }

  // 3. Fallback: Exact Cosine Similarity search on document-filtered chunks
  // Strictly filter by documentId at the database layer to ensure complete document isolation
  const chunks = await AiChunk.find({
    documentId: { $in: [docObjectId, docObjectId.toString()] },
    embedding: { $exists: true, $ne: null, $not: { $size: 0 } }
  })
    .select('documentId chunkIndex text pageNumber embedding')
    .lean()

  if (!chunks || chunks.length === 0) {
    return []
  }

  // Calculate similarity score for each chunk with valid embedding vector
  const scoredChunks = chunks
    .filter(chunk => Array.isArray(chunk.embedding) && chunk.embedding.length > 0)
    .map(chunk => ({
      documentId: chunk.documentId.toString(),
      chunkIndex: chunk.chunkIndex,
      text: chunk.text,
      pageNumber: chunk.pageNumber,
      score: parseFloat(cosineSimilarity(questionEmbedding, chunk.embedding).toFixed(4))
    }))

  // Sort descending by similarity score
  scoredChunks.sort((a, b) => b.score - a.score)

  // Return top K
  return scoredChunks.slice(0, cleanTopK)
}
