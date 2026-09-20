import crypto from 'crypto'
import fs from 'fs'
import path from 'path'
import { Router } from 'express'
import multer from 'multer'
import {
  uploadAiDocument,
  listAiDocuments,
  deleteAiDocument,
  searchDocumentChunks,
  getAiDocumentFile
} from '../controllers/aiDocumentController.js'
import { protect } from '../middleware/authMiddleware.js'

const storageDirectory = path.resolve(process.cwd(), process.env.AI_DOCUMENT_STORAGE_DIR || 'storage/ai-documents')
fs.mkdirSync(storageDirectory, { recursive: true })

const storage = multer.diskStorage({
  destination: storageDirectory,
  filename: (req, file, callback) => callback(null, `${crypto.randomUUID()}.pdf`)
})

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, callback) => {
    const isPdf = file.mimetype === 'application/pdf' && file.originalname.toLowerCase().endsWith('.pdf')
    if (isPdf) return callback(null, true)
    const error = new Error('Only PDF files are allowed.')
    error.status = 400
    callback(error)
  }
})

const router = Router()

// List all indexed AI documents for the current user
router.get('/', protect, listAiDocuments)

// Upload and index a PDF document
router.post('/', protect, upload.single('file'), uploadAiDocument)

// Delete an indexed PDF document
router.delete('/:id', protect, deleteAiDocument)

// Semantic vector search test/debug endpoints
router.post('/search', protect, searchDocumentChunks)
router.post('/:id/search', protect, searchDocumentChunks)
router.get('/:id/search', protect, searchDocumentChunks)

// Serve document file for PDF viewer with inline page navigation
router.get('/:id/file', protect, getAiDocumentFile)

export default router
