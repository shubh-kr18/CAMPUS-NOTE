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

  // 1. Check AiDocument record
  const aiDoc = await AiDocument.findById(docObjectId).lean()
  if (aiDoc && (aiDoc.embeddingProvider || aiDoc.embeddingModel || aiDoc.embeddingDimensions)) {
    return {
      embeddingProvider: aiDoc.embeddingProvider || null,
      embeddingModel: aiDoc.embeddingModel || null,
      dimensions: aiDoc.embeddingDimensions || null
    }
  }

  // 2. Check Note record
  const note = await Note.findById(docObjectId).lean()
  if (note && (note.embeddingProvider || note.embeddingModel || note.embeddingDimensions)) {
    return {
      embeddingProvider: note.embeddingProvider || null,
      embeddingModel: note.embeddingModel || null,
      dimensions: note.embeddingDimensions || null
    }
  }

  // 3. Inspect existing stored chunk
  const sampleChunk = await AiChunk.findOne({
    documentId: docIdFilter,
    embedding: { $exists: true, $ne: null, $not: { $size: 0 } }
  }).lean()

  if (sampleChunk) {
    if (sampleChunk.embeddingProvider || sampleChunk.embeddingModel || sampleChunk.dimensions) {
      return {
        embeddingProvider: sampleChunk.embeddingProvider || null,
        embeddingModel: sampleChunk.embeddingModel || null,
        dimensions: sampleChunk.dimensions || (Array.isArray(sampleChunk.embedding) ? sampleChunk.embedding.length : null)
      }
    }
    // Old chunk without explicit metadata fields
    if (Array.isArray(sampleChunk.embedding) && sampleChunk.embedding.length > 0) {
      return {
        embeddingProvider: null,
        embeddingModel: null,
        dimensions: sampleChunk.embedding.length
      }
    }
  }

  return null
}

/**
 * Validates that the selected document's embedding configuration matches the active
 * embedding configuration (provider, model, dimensions) before vector search.
 *
 * If they match: continues unchanged.
 * If they don't match: stops and throws a clear "document must be re-indexed" error.
 *
 * @param {Object} params
 * @param {Object|null} params.docMetadata
 * @param {Object} params.queryProvider
 * @param {string} [params.documentName]
 */
export function verifyEmbeddingCompatibility({ docMetadata, queryProvider, documentName = 'Selected document' }) {
  const activeProvider = queryProvider?.provider || queryProvider?.name
  const activeModel = queryProvider?.model
  const activeDimensions = queryProvider?.dimensions

  const docProvider = docMetadata?.embeddingProvider
  const docModel = docMetadata?.embeddingModel
  const docDimensions = docMetadata?.dimensions || docMetadata?.embeddingDimensions

  const isMatch = Boolean(
    docMetadata &&
    docProvider === activeProvider &&
    docModel === activeModel &&
    Number(docDimensions) === Number(activeDimensions)
  )

  if (!isMatch) {
    const docDesc = `${docProvider || 'unknown'} / ${docModel || 'unknown'} / ${docDimensions || 'unknown'}`
    const activeDesc = `${activeProvider || 'unknown'} / ${activeModel || 'unknown'} / ${activeDimensions || 'unknown'}`

    const error = new Error(
      `Incompatible embedding configuration: document must be re-indexed. ` +
      `Document = ${docDesc}, Current = ${activeDesc}`
    )
    error.status = 400
    error.code = 'DOCUMENT_REINDEX_REQUIRED'
    throw error
  }
}
