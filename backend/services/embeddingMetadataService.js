import mongoose from 'mongoose'
import Note from '../models/Note.js'
import AiDocument from '../models/AiDocument.js'
import AiChunk from '../models/AiChunk.js'

/**
 * Retrieves the embedding metadata (provider, model, dimensions) for an indexed document.
 * Checks Note, AiDocument, and underlying stored AiChunks.
 *
 * For existing/legacy documents where metadata was not explicitly saved,
 * it inspects chunk vector length and defaults to 'ollama' + 'nomic-embed-text' (768 dims)
 * so existing Ollama embeddings remain 100% usable without deletion.
 *
 * @param {string|mongoose.Types.ObjectId} documentId
 * @returns {Promise<{ embeddingProvider: string, embeddingModel: string, dimensions: number } | null>}
 */
export async function getDocumentEmbeddingMetadata(documentId) {
  if (!documentId) return null

  const docObjectId = mongoose.Types.ObjectId.isValid(documentId)
    ? new mongoose.Types.ObjectId(documentId)
    : documentId

  const docIdFilter = { $in: [docObjectId, docObjectId.toString()] }

  // 1. Inspect existing stored chunk
  const sampleChunk = await AiChunk.findOne({
    documentId: docIdFilter,
    embedding: { $exists: true, $ne: null, $not: { $size: 0 } }
  }).lean()

  if (sampleChunk && Array.isArray(sampleChunk.embedding) && sampleChunk.embedding.length > 0) {
    const vectorLength = sampleChunk.embedding.length
    const provider = sampleChunk.embeddingProvider || 'ollama'
    const model = sampleChunk.embeddingModel || (vectorLength === 768 ? 'nomic-embed-text' : (vectorLength === 1536 ? 'text-embedding-3-small' : 'unknown'))
    const dimensions = sampleChunk.dimensions || vectorLength

    return {
      embeddingProvider: provider,
      embeddingModel: model,
      dimensions
    }
  }

  // 2. Check AiDocument record
  const aiDoc = await AiDocument.findById(docObjectId).lean()
  if (aiDoc && aiDoc.embeddingProvider && aiDoc.embeddingModel) {
    return {
      embeddingProvider: aiDoc.embeddingProvider,
      embeddingModel: aiDoc.embeddingModel,
      dimensions: aiDoc.embeddingDimensions || 768
    }
  }

  // 3. Check Note record
  const note = await Note.findById(docObjectId).lean()
  if (note && note.embeddingProvider && note.embeddingModel) {
    return {
      embeddingProvider: note.embeddingProvider,
      embeddingModel: note.embeddingModel,
      dimensions: note.embeddingDimensions || 768
    }
  }

  return null
}

/**
 * Validates that the active query embedding provider and model are compatible with
 * the document's stored embeddings. Prevents comparing vectors across different
 * models or dimensions.
 *
 * @param {Object} params
 * @param {Object|null} params.docMetadata
 * @param {Object} params.queryProvider
 * @param {string} [params.documentName]
 */
export function verifyEmbeddingCompatibility({ docMetadata, queryProvider, documentName = 'Selected document' }) {
  if (!docMetadata) return

  // Check dimension mismatch
  if (docMetadata.dimensions && queryProvider.dimensions && docMetadata.dimensions !== queryProvider.dimensions) {
    const error = new Error(
      `Incompatible embedding dimensions: Document "${documentName}" was indexed with ${docMetadata.embeddingProvider} (${docMetadata.embeddingModel}, ${docMetadata.dimensions} dims), which cannot be queried with ${queryProvider.name} (${queryProvider.model}, ${queryProvider.dimensions} dims).`
    )
    error.status = 400
    error.code = 'EMBEDDING_DIMENSION_MISMATCH'
    throw error
  }

  // Check model/provider mismatch
  if (
    docMetadata.embeddingProvider !== queryProvider.name ||
    docMetadata.embeddingModel !== queryProvider.model
  ) {
    const error = new Error(
      `Incompatible embedding provider/model: Document "${documentName}" was indexed with ${docMetadata.embeddingProvider} (${docMetadata.embeddingModel}), which cannot be mixed with query provider ${queryProvider.name} (${queryProvider.model}).`
    )
    error.status = 400
    error.code = 'EMBEDDING_PROVIDER_MISMATCH'
    throw error
  }
}
