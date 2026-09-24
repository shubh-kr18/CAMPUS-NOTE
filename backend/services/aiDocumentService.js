import fs from 'fs/promises'
import path from 'path'
import mongoose from 'mongoose'
import Note from '../models/Note.js'
import AiDocument from '../models/AiDocument.js'
import AiPage from '../models/AiPage.js'
import AiChunk from '../models/AiChunk.js'
import { extractPagesFromPdf } from './pdfService.js'
import { chunkPages } from './chunkingService.js'
import { generateEmbeddings } from './embeddingService.js'
import { getEmbeddingProvider } from './providers/index.js'

// ─── Helpers ────────────────────────────────────────────────────────────────

/**
 * Read the first 5 bytes of a file and confirm it starts with the PDF magic
 * number (%PDF-). Runs before we trust the MIME type from the browser.
 */
export async function isPdfFile(filePath) {
  const handle = await fs.open(filePath, 'r')
  try {
    const buffer = Buffer.alloc(5)
    await handle.read(buffer, 0, buffer.length, 0)
    return buffer.toString('ascii') === '%PDF-'
  } finally {
    await handle.close()
  }
}

// ─── Main service function ───────────────────────────────────────────────────

/**
 * Full pipeline for an uploaded PDF:
 *   1. Validate magic bytes (400 if not a real PDF)
 *   2. Create AiDocument record with status 'processing'
 *   3. Extract text page-by-page with pdfService
 *   4. Bulk-insert one AiPage document per page
 *   5. Chunk pages with chunkingService and save into AiChunk
 *   6. Fetch stored chunks, generate Ollama embeddings, and update records
 *   7. Update AiDocument → status 'ready', pageCount, chunkCount
 *   8. Log processing stats
 */
export async function createAiDocument(file, userId, subjectId = 'General') {
  // Step 1 — magic-byte check
  const isPdf = await isPdfFile(file.path)
  if (!isPdf) {
    await fs.unlink(file.path).catch(() => {})
    const error = new Error('The uploaded file is not a valid PDF.')
    error.status = 400
    throw error
  }

  // Step 2 — persist document metadata record (status starts as 'processing')
  let document
  try {
    document = await AiDocument.create({
      originalName: file.originalname,
      storageKey:   file.filename,
      mimeType:     'application/pdf',
      fileSize:     file.size,
      uploadedBy:   userId,
      subjectId:    (subjectId || 'General').trim()
    })
  } catch (err) {
    await fs.unlink(file.path).catch(() => {})
    throw err
  }

  try {
    const { pageCount, chunkCount } = await indexPdfFileForDocument({
      documentId: document._id,
      filePath: file.path
    })

    const embeddingProvider = getEmbeddingProvider()
    const providerName = embeddingProvider.provider || embeddingProvider.name
    const modelName = embeddingProvider.model
    const dimensions = embeddingProvider.dimensions

    // Step 7 — mark document ready
    document.status              = 'ready'
    document.pageCount           = pageCount
    document.chunkCount          = chunkCount
    document.embeddingProvider   = providerName
    document.embeddingModel      = modelName
    document.embeddingDimensions = dimensions
    await document.save()
  } catch (error) {
    console.error(`[PDF Processing Error] Failed to process document ${document._id}:`, error.message)

    // Mark as failed in DB
    document.status          = 'failed'
    document.extractionError = error.message
    await document.save().catch(() => {})

    const err = new Error(
      error.message || 'PDF processing failed during extraction or embedding generation.'
    )
    err.status = 500
    throw err
  }

  return document
}

/**
 * Indexes any PDF file (such as a Student Note or AiDocument) into AiPage and AiChunk collections.
 *
 * @param {Object} params
 * @param {string|mongoose.Types.ObjectId} params.documentId
 * @param {string} params.filePath
 * @returns {Promise<{ pageCount: number, chunkCount: number, embeddingsCount: number }>}
 */
export async function indexPdfFileForDocument({ documentId, filePath }) {
  const docObjectId = mongoose.Types.ObjectId.isValid(documentId)
    ? new mongoose.Types.ObjectId(documentId)
    : documentId
  const docIdFilter = { $in: [docObjectId, docObjectId.toString()] }

  // 1. Removes only that document's old vectors and pages
  await Promise.all([
    AiPage.deleteMany({ documentId: docIdFilter }),
    AiChunk.deleteMany({ documentId: docIdFilter })
  ])

  // Extract text and store pages
  const pages = await extractPagesFromPdf(filePath)

  if (pages.length > 0) {
    await AiPage.insertMany(
      pages.map(page => ({
        documentId: docObjectId,
        pageNumber: page.pageNumber,
        text:       page.text,
        charCount:  page.text.length
      }))
    )
  }

  // Chunk pages and store chunks in DB
  const chunks = chunkPages(pages)
  if (chunks.length > 0) {
    await AiChunk.insertMany(
      chunks.map(chunk => ({
        documentId: docObjectId,
        chunkIndex: chunk.chunkIndex,
        pageNumber: chunk.pageNumber,
        text:       chunk.text,
        charCount:  chunk.charCount
      }))
    )
  }

  console.log(`PDF processed for ${documentId}\nPages: ${pages.length}\nChunks: ${chunks.length}`)

  // Get stored chunks and generate embeddings
  const storedChunks = await AiChunk.find({ documentId: docIdFilter }).sort('chunkIndex')
  let embeddingsGeneratedCount = 0

  // 3. Uses the current embedding provider
  const embeddingProvider = getEmbeddingProvider()
  const providerName = embeddingProvider.provider || embeddingProvider.name
  const modelName = embeddingProvider.model
  const dimensions = embeddingProvider.dimensions

  if (storedChunks.length === 0) {
    const error = new Error('No text chunks could be extracted from the PDF to generate embeddings.')
    error.status = 400
    throw error
  }

  const textsToEmbed = storedChunks.map(c => c.text)
  const embeddings = await generateEmbeddings(textsToEmbed)
  embeddingsGeneratedCount = embeddings.length

  // 4. Stores the new provider/model/dimensions on chunks
  const bulkOps = storedChunks.map((chunk, index) => ({
    updateOne: {
      filter: { _id: chunk._id },
      update: {
        $set: {
          embedding: embeddings[index],
          embeddingProvider: providerName,
          embeddingModel: modelName,
          dimensions: embeddings[index]?.length || dimensions
        }
      }
    }
  }))

  if (bulkOps.length > 0) {
    await AiChunk.bulkWrite(bulkOps)
  }

  // 4 & 5. Stores new provider/model/dimensions and marks indexing successful ONLY after completion
  await Promise.all([
    AiDocument.findByIdAndUpdate(docObjectId, {
      $set: {
        status: 'ready',
        pageCount: pages.length,
        chunkCount: storedChunks.length,
        embeddingProvider: providerName,
        embeddingModel: modelName,
        embeddingDimensions: dimensions,
        extractionError: undefined
      }
    }),
    Note.findByIdAndUpdate(docObjectId, {
      $set: {
        embeddingProvider: providerName,
        embeddingModel: modelName,
        embeddingDimensions: dimensions
      }
    })
  ]).catch(() => {})

  console.log(`Chunks: ${storedChunks.length}\nEmbeddings generated: ${embeddingsGeneratedCount} (${providerName}/${modelName})`)

  return {
    pageCount: pages.length,
    chunkCount: storedChunks.length,
    embeddingsCount: embeddingsGeneratedCount
  }
}

// ─── Serialiser ─────────────────────────────────────────────────────────────

/** Shape returned to the client after a successful upload. */
export const publicDocument = document => ({
  documentId: document._id,
  subjectId:  document.subjectId || 'General',
  filename:   document.originalName,
  fileSize:   document.fileSize,
  uploadedAt: document.createdAt,
  status:     document.status,
  pageCount:  document.pageCount ?? 0,
  chunkCount: document.chunkCount ?? 0,
  ...(document.embeddingProvider ? {
    embeddingProvider: document.embeddingProvider,
    embeddingModel: document.embeddingModel,
    embeddingDimensions: document.embeddingDimensions
  } : {})
})

/**
 * Explicitly re-indexes an existing document (AiDocument or Note) using the current active embedding configuration.
 *
 * @param {string|mongoose.Types.ObjectId} documentId
 * @returns {Promise<{ documentId: string, status?: string, pageCount: number, chunkCount: number, embeddingsCount: number, embeddingProvider: string, embeddingModel: string, embeddingDimensions: number }>}
 */
export async function reindexAiDocument(documentId) {
  const docObjectId = mongoose.Types.ObjectId.isValid(documentId)
    ? new mongoose.Types.ObjectId(documentId)
    : documentId

  // 1. Check AiDocument
  const aiDoc = await AiDocument.findById(docObjectId)
  if (aiDoc) {
    const storageDirectory = path.resolve(process.cwd(), process.env.AI_DOCUMENT_STORAGE_DIR || 'storage/ai-documents')
    const filePath = path.join(storageDirectory, aiDoc.storageKey)
    try {
      await fs.access(filePath)
    } catch {
      const err = new Error(`PDF file not found for document "${aiDoc.originalName}".`)
      err.status = 404
      throw err
    }

    aiDoc.status = 'processing'
    await aiDoc.save()

    try {
      const stats = await indexPdfFileForDocument({ documentId: aiDoc._id, filePath })
      const provider = getEmbeddingProvider()
      const providerName = provider.provider || provider.name
      const modelName = provider.model
      const dimensions = provider.dimensions

      aiDoc.status = 'ready'
      aiDoc.pageCount = stats.pageCount
      aiDoc.chunkCount = stats.chunkCount
      aiDoc.embeddingProvider = providerName
      aiDoc.embeddingModel = modelName
      aiDoc.embeddingDimensions = dimensions
      aiDoc.extractionError = undefined
      await aiDoc.save()

      return {
        documentId: aiDoc._id,
        status: 'ready',
        ...stats,
        embeddingProvider: providerName,
        embeddingModel: modelName,
        embeddingDimensions: dimensions
      }
    } catch (err) {
      aiDoc.status = 'failed'
      aiDoc.extractionError = err.message
      await aiDoc.save().catch(() => {})
      throw err
    }
  }

  // 2. Check Note
  const note = await Note.findById(docObjectId)
  if (note && note.fileUrl) {
    const filePath = path.resolve(process.cwd(), 'uploads', path.basename(note.fileUrl))
    try {
      await fs.access(filePath)
    } catch {
      const err = new Error(`PDF file not found for note "${note.title}".`)
      err.status = 404
      throw err
    }

    const stats = await indexPdfFileForDocument({ documentId: note._id, filePath })
    const provider = getEmbeddingProvider()
    const providerName = provider.provider || provider.name
    const modelName = provider.model
    const dimensions = provider.dimensions

    note.embeddingProvider = providerName
    note.embeddingModel = modelName
    note.embeddingDimensions = dimensions
    await note.save()

    return {
      documentId: note._id,
      ...stats,
      embeddingProvider: providerName,
      embeddingModel: modelName,
      embeddingDimensions: dimensions
    }
  }

  const err = new Error('Document not found.')
  err.status = 404
  throw err
}
