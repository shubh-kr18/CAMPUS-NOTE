import path from 'path'
import mongoose from 'mongoose'
import Note from '../models/Note.js'
import AiDocument from '../models/AiDocument.js'
import AiChunk from '../models/AiChunk.js'
import { getOllamaConfig, isOllamaConnectionError, createOllamaConnectionError } from '../config/env.js'
import { getLlmProvider, getEmbeddingProvider } from './providers/index.js'
import { indexPdfFileForDocument } from './aiDocumentService.js'
import { generateEmbeddings } from './embeddingService.js'
import { searchSimilarChunks } from './vectorSearchService.js'

/**
 * Ensures that document chunks exist in DB and have valid embedding vectors.
 * If chunks were never created, it parses the PDF from uploads.
 * If chunks exist but embeddings are missing or incomplete, it generates them.
 */
export async function ensureDocumentEmbedded({ documentId, fileUrl }) {
  const docObjectId = mongoose.Types.ObjectId.isValid(documentId)
    ? new mongoose.Types.ObjectId(documentId)
    : documentId

  const docIdFilter = { $in: [docObjectId, docObjectId.toString()] }

  const totalChunks = await AiChunk.countDocuments({ documentId: docIdFilter })
  const embeddedChunks = await AiChunk.countDocuments({
    documentId: docIdFilter,
    embedding: { $exists: true, $ne: null, $not: { $size: 0 } }
  })

  // 1. If chunks were never created, run full extraction and embedding
  if (totalChunks === 0 && fileUrl) {
    const filePath = path.resolve(process.cwd(), 'uploads', path.basename(fileUrl))
    await indexPdfFileForDocument({ documentId: docObjectId, filePath })
    return
  }

  // 2. If chunks exist but embeddings are missing or incomplete, generate embeddings for un-embedded chunks
  if (totalChunks > 0 && embeddedChunks < totalChunks) {
    const missingChunks = await AiChunk.find({
      documentId: docIdFilter,
      $or: [
        { embedding: { $exists: false } },
        { embedding: null },
        { embedding: { $size: 0 } }
      ]
    }).sort('chunkIndex')

    if (missingChunks.length > 0) {
      const textsToEmbed = missingChunks.map(c => c.text)
      const embeddings = await generateEmbeddings(textsToEmbed)
      const provider = getEmbeddingProvider()

      const bulkOps = missingChunks.map((chunk, index) => ({
        updateOne: {
          filter: { _id: chunk._id },
          update: {
            $set: {
              embedding: embeddings[index],
              embeddingProvider: provider.provider || provider.name,
              embeddingModel: provider.model,
              dimensions: embeddings[index]?.length || provider.dimensions
            }
          }
        }
      }))
      if (bulkOps.length > 0) {
        await AiChunk.bulkWrite(bulkOps)
      }
    }
  }
}

/**
 * Executes the full RAG question-answering pipeline:
 *  1. Validates document existence in Student Notes (or legacy AiDocument).
 *  2. Runs semantic vector search to retrieve relevant chunks strictly for this documentId.
 *  3. Constructs a grounded context prompt with source page numbers.
 *  4. Calls Ollama chat completion to generate an answer based strictly on the PDF.
 *  5. Returns answer, documentName, documentId, and deduplicated source pages.
 *
 * @param {Object} params
 * @param {string} params.documentId - ID of the uploaded PDF document (Note._id).
 * @param {string} params.question - The student's question.
 * @param {number} [params.topK=5] - Number of top chunks to retrieve.
 * @param {string} params.userId - Authenticated user ID.
 * @param {string} [params.userRole] - Role of the user (e.g. 'student' or 'admin').
 * @returns {Promise<{ answer: string, documentId: string, documentName: string, subjectId: string, sources: Array<{ documentId: string, documentName: string, pageNumber: number }> }>}
 */
export async function answerQuestionWithRag({ documentId, question, subjectId: requestedSubjectId, topK = 5, userId, userRole }) {
  if (!documentId) {
    const error = new Error('documentId is required.')
    error.status = 400
    throw error
  }
  if (!question || !question.trim()) {
    const error = new Error('Please enter a question.')
    error.status = 400
    throw error
  }

  // 1. Validate document existence and user ownership
  const docObjectId = mongoose.Types.ObjectId.isValid(documentId)
    ? new mongoose.Types.ObjectId(documentId)
    : documentId

  let documentName = ''
  let subjectId = requestedSubjectId || 'General'

  // Look up Note from Student Notes first (primary source)
  const note = await Note.findById(docObjectId)
  if (note) {
    documentName = note.originalName || (note.title?.toLowerCase().endsWith('.pdf') ? note.title : `${note.title}.pdf`) || 'Document.pdf'
    subjectId = note.subject || requestedSubjectId || 'General'

    // Verify document belongs to requested subject if provided
    if (requestedSubjectId && note.subject && note.subject !== requestedSubjectId) {
      const error = new Error(`Document does not belong to subject "${requestedSubjectId}".`)
      error.status = 400
      throw error
    }

    // Ensure chunks exist and have embeddings
    if (note.fileUrl) {
      try {
        await ensureDocumentEmbedded({ documentId: docObjectId, fileUrl: note.fileUrl })
      } catch (embeddingError) {
        console.warn(`[On-demand Indexing Warning for note ${docObjectId}]:`, embeddingError.message)
      }
    }
  } else {
    // Fallback to legacy AiDocument
    const aiDoc = await AiDocument.findById(docObjectId)
    if (!aiDoc) {
      const error = new Error('Document not found in Student Notes.')
      error.status = 404
      throw error
    }

    const isOwner = aiDoc.uploadedBy && aiDoc.uploadedBy.toString() === userId?.toString()
    const isAdmin = userRole === 'admin'
    if (!isOwner && !isAdmin) {
      const error = new Error('You do not have access to this document.')
      error.status = 403
      throw error
    }

    if (aiDoc.status === 'processing') {
      const error = new Error('Document is still processing. Please wait a moment and try again.')
      error.status = 400
      throw error
    }

    if (aiDoc.status === 'failed') {
      const error = new Error('Document extraction or processing failed. Please re-upload the PDF.')
      error.status = 400
      throw error
    }

    documentName = aiDoc.originalName
    subjectId = aiDoc.subjectId || requestedSubjectId || 'General'
  }

  console.log('[RAG DEBUG Stage 1] Selected documentId:', docObjectId.toString(), 'DocumentName:', documentName, 'SubjectId:', subjectId)

  // 2. Vector search strictly for this document
  console.log('[RAG DEBUG Stage 2] Generating question embedding for question:', `"${question.trim().slice(0, 80)}"`)
  const chunks = await searchSimilarChunks({
    documentId: docObjectId,
    question: question.trim(),
    topK,
    documentName
  })

  console.log('[RAG DEBUG Stage 3] Vector search result count:', chunks?.length || 0)
  const retrievedDocIds = chunks?.map(c => c.documentId) || []
  console.log('[RAG DEBUG Stage 4] Retrieved chunk documentIds:', retrievedDocIds)

  // If no chunks found, return immediately without calling LLM
  if (!chunks || chunks.length === 0) {
    console.log('[RAG DEBUG Stage 5 & 6] Skipped LLM request (0 chunks found for documentId)')
    return {
      answer: 'The information was not found in the selected document.',
      documentId: docObjectId.toString(),
      subjectId,
      documentName,
      sources: []
    }
  }

  // 3. Collect and deduplicate unique sources (preserving verified page numbers without fabrication)
  const uniquePages = new Set()
  const sources = []

  for (const chunk of chunks) {
    if (typeof chunk.pageNumber === 'number' && !uniquePages.has(chunk.pageNumber)) {
      uniquePages.add(chunk.pageNumber)
      sources.push({
        documentId: docObjectId.toString(),
        documentName,
        pageNumber: chunk.pageNumber
      })
    }
  }

  // Sort ascending by page number
  sources.sort((a, b) => a.pageNumber - b.pageNumber)

  // 4. Build retrieved context string
  const contextParts = chunks.map((c, i) => {
    const pageLabel = c.pageNumber ? `Page ${c.pageNumber}` : 'Page unknown'
    return `[Passage ${i + 1} | ${pageLabel}]\n${c.text}`
  })
  const contextText = contextParts.join('\n\n')

  // 5. System instructions and user prompt
  const systemPrompt = `You are Campus Note AI, an academic assistant for university students.
Your task is to answer the student's question strictly and exclusively based on the provided context extracted from the selected document "${documentName}".

Strict Rules:
1. Answer ONLY using the facts directly stated in the context passages below.
2. If the answer is not present in the provided context, respond clearly and concisely: "The information was not found in the selected document."
3. Do NOT invent, assume, extrapolate, or bring in any outside knowledge or information not contained in the context.
4. Do NOT use information or citations from any other documents or PDFs.
5. Do NOT fabricate or guess page numbers. Only cite page numbers explicitly indicated in the context passages.
6. Keep explanations clear, structured, and factual.`

  const userPrompt = `Context from document "${documentName}":
====================
${contextText}
====================

Student Question: ${question.trim()}`

  // 6. Call active LLM Provider
  const llmProvider = getLlmProvider()

  console.log('[RAG DEBUG Stage 5] Sending LLM request via provider:', llmProvider.name, 'Context passages count:', chunks.length, 'Unique source pages:', sources.map(s => s.pageNumber))

  const rawAnswer = await llmProvider.generateChatCompletion({
    systemPrompt,
    userPrompt,
    temperature: 0.0
  })

  let answer = rawAnswer?.trim() || 'The information was not found in the selected document.'
  if (!answer) {
    answer = 'The information was not found in the selected document.'
  }

  console.log('[RAG DEBUG Stage 6] Received LLM response. Length:', answer.length, 'Snippet:', answer.slice(0, 100))

  // If information was not found in the selected document, do not attach misleading sources
  const lowerAnswer = answer.toLowerCase()
  const isNotFound =
    lowerAnswer.includes('information was not found') ||
    lowerAnswer.includes('not found in the selected document') ||
    lowerAnswer.includes('not present in the provided context') ||
    lowerAnswer.includes('not found in the provided context')

  return {
    answer,
    documentId: docObjectId.toString(),
    subjectId,
    documentName,
    sources: isNotFound ? [] : sources
  }
}
