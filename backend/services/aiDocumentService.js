import fs from 'fs/promises'
import AiDocument from '../models/AiDocument.js'
import AiPage from '../models/AiPage.js'
import AiChunk from '../models/AiChunk.js'
import { extractPagesFromPdf } from './pdfService.js'
import { chunkPages } from './chunkingService.js'
import { generateEmbeddings } from './embeddingService.js'

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

    // Step 7 — mark document ready
    document.status     = 'ready'
    document.pageCount  = pageCount
    document.chunkCount = chunkCount
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
  // Clear any pre-existing chunks or pages for this documentId
  await Promise.all([
    AiPage.deleteMany({ documentId }),
    AiChunk.deleteMany({ documentId })
  ])

  // Extract text and store pages
  const pages = await extractPagesFromPdf(filePath)

  if (pages.length > 0) {
    await AiPage.insertMany(
      pages.map(page => ({
        documentId,
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
        documentId,
        chunkIndex: chunk.chunkIndex,
        pageNumber: chunk.pageNumber,
        text:       chunk.text,
        charCount:  chunk.charCount
      }))
    )
  }

  console.log(`PDF processed for ${documentId}\nPages: ${pages.length}\nChunks: ${chunks.length}`)

  // Get stored chunks and generate embeddings
  const storedChunks = await AiChunk.find({ documentId }).sort('chunkIndex')
  let embeddingsGeneratedCount = 0

  if (storedChunks.length > 0) {
    const textsToEmbed = storedChunks.map(c => c.text)
    const embeddings = await generateEmbeddings(textsToEmbed)
    embeddingsGeneratedCount = embeddings.length

    // Save embeddings back to chunks without duplicate records
    const bulkOps = storedChunks.map((chunk, index) => ({
      updateOne: {
        filter: { _id: chunk._id },
        update: { $set: { embedding: embeddings[index] } }
      }
    }))

    if (bulkOps.length > 0) {
      await AiChunk.bulkWrite(bulkOps)
    }
  }

  console.log(`Chunks: ${storedChunks.length}\nEmbeddings generated: ${embeddingsGeneratedCount}`)

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
  chunkCount: document.chunkCount ?? 0
})
