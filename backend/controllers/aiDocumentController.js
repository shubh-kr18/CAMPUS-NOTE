import fs from 'fs/promises'
import path from 'path'
import Note from '../models/Note.js'
import AiDocument from '../models/AiDocument.js'
import AiPage from '../models/AiPage.js'
import AiChunk from '../models/AiChunk.js'
import { createAiDocument, publicDocument } from '../services/aiDocumentService.js'
import { searchSimilarChunks } from '../services/vectorSearchService.js'

/**
 * Upload and index a new AI document PDF.
 */
export async function uploadAiDocument(req, res, next) {
  try {
    if (!req.file) return res.status(400).json({ success: false, message: 'Select a PDF file to upload.' })
    const subjectId = req.body.subjectId || req.body.subject || 'General'
    const document = await createAiDocument(req.file, req.userId, subjectId)
    res.status(201).json({ success: true, ...publicDocument(document) })
  } catch (error) {
    next(error)
  }
}

/**
 * Lists all indexed AI documents uploaded by the authenticated user, optionally filtered by subjectId.
 */
export async function listAiDocuments(req, res, next) {
  try {
    const filter = req.user?.role === 'admin' ? {} : { uploadedBy: req.userId }
    if (req.query.subjectId || req.query.subject) {
      filter.subjectId = req.query.subjectId || req.query.subject
    }
    const documents = await AiDocument.find(filter).sort('-createdAt')
    res.json({
      success: true,
      documents: documents.map(publicDocument)
    })
  } catch (error) {
    next(error)
  }
}

/**
 * Deletes an indexed document, its extracted pages, vector chunks, and PDF file.
 */
export async function deleteAiDocument(req, res, next) {
  try {
    const document = await AiDocument.findById(req.params.id)
    if (!document) {
      return res.status(404).json({ message: 'Document not found.' })
    }

    const isOwner = document.uploadedBy && document.uploadedBy.toString() === req.userId?.toString()
    const isAdmin = req.user?.role === 'admin'
    if (!isOwner && !isAdmin) {
      return res.status(403).json({ message: 'Access denied.' })
    }

    const storageDirectory = path.resolve(process.cwd(), process.env.AI_DOCUMENT_STORAGE_DIR || 'storage/ai-documents')
    const filePath = path.join(storageDirectory, document.storageKey)
    await fs.unlink(filePath).catch(() => {})

    await Promise.all([
      AiPage.deleteMany({ documentId: document._id }),
      AiChunk.deleteMany({ documentId: document._id }),
      document.deleteOne()
    ])

    res.json({ success: true, message: 'Document removed.' })
  } catch (error) {
    next(error)
  }
}

/**
 * Debug/test endpoint for vector search.
 * Accepts { documentId, question, topK } via POST body or query params.
 */
export async function searchDocumentChunks(req, res, next) {
  try {
    const documentId = req.params.id || req.body.documentId || req.query.documentId
    const question = req.body.question || req.query.question || req.query.q
    const topK = req.body.topK || req.query.topK

    if (!documentId) {
      return res.status(400).json({ success: false, message: 'documentId is required.' })
    }
    if (!question || typeof question !== 'string' || !question.trim()) {
      return res.status(400).json({ success: false, message: 'question is required and must be non-empty.' })
    }

    const results = await searchSimilarChunks({
      documentId,
      question: question.trim(),
      topK
    })

    res.json({
      success: true,
      documentId,
      question: question.trim(),
      count: results.length,
      results
    })
  } catch (error) {
    next(error)
  }
}

/**
 * Serves the PDF file for viewing with inline content disposition.
 * Allows viewing specific pages in the browser PDF viewer.
 */
export async function getAiDocumentFile(req, res, next) {
  try {
    // Check Student Notes first
    const note = await Note.findById(req.params.id)
    if (note) {
      const filePath = path.resolve(process.cwd(), 'uploads', path.basename(note.fileUrl))
      try {
        await fs.access(filePath)
      } catch {
        return res.status(404).json({ message: 'Note PDF file not found on disk.' })
      }
      res.setHeader('Content-Type', 'application/pdf')
      res.setHeader('Content-Disposition', `inline; filename="${encodeURIComponent(note.originalName || note.title)}"`)
      return res.sendFile(filePath)
    }

    const document = await AiDocument.findById(req.params.id)
    if (!document) {
      return res.status(404).json({ message: 'Document not found.' })
    }

    const isOwner = document.uploadedBy && document.uploadedBy.toString() === req.userId?.toString()
    const isAdmin = req.user?.role === 'admin'
    if (!isOwner && !isAdmin) {
      return res.status(403).json({ message: 'Access denied.' })
    }

    const storageDirectory = path.resolve(process.cwd(), process.env.AI_DOCUMENT_STORAGE_DIR || 'storage/ai-documents')
    const filePath = path.join(storageDirectory, document.storageKey)

    res.setHeader('Content-Type', 'application/pdf')
    res.setHeader('Content-Disposition', `inline; filename="${encodeURIComponent(document.originalName)}"`)
    res.sendFile(filePath)
  } catch (error) {
    next(error)
  }
}
