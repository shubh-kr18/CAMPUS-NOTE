import fs from 'fs/promises'
import path from 'path'
import Note from '../models/Note.js'
import AiPage from '../models/AiPage.js'
import AiChunk from '../models/AiChunk.js'
import { canManageNotes } from '../middleware/authMiddleware.js'
import { indexPdfFileForDocument } from '../services/aiDocumentService.js'

const SUBJECTS = ['DSP — Digital Signal Processing', 'DSD — Digital System Design', 'VLSI', 'Wireless Communication', 'Microwave']

export async function listNotes(req, res, next) {
  try {
    const query = req.query.subject ? { subject: req.query.subject } : {}
    res.json({
      notes: await Note.find(query).populate('uploadedBy', 'name').sort('-createdAt'),
      subjects: SUBJECTS,
      canManage: canManageNotes(req.user)
    })
  } catch(e) {
    next(e)
  }
}

export async function getNote(req, res, next) {
  try {
    const note = await Note.findById(req.params.id)
    if (!note) return res.status(404).json({ message: 'Note not found.' })
    res.json({ note })
  } catch(e) {
    next(e)
  }
}

export async function createNote(req, res, next) {
  try {
    if (!req.file) return res.status(400).json({ message: 'Please upload a PDF file.' })
    const { title, subject, description = '' } = req.body
    if (!title?.trim() || !subject) return res.status(400).json({ message: 'Title and subject are required.' })
    if (!SUBJECTS.includes(subject)) return res.status(400).json({ message: 'Choose a valid Student Notes subject.' })
    const duplicate = await Note.findOne({ title: title.trim(), subject })
    if (duplicate) {
      await fs.unlink(req.file.path).catch(() => {})
      return res.status(409).json({ message: 'A PDF with this title already exists for this subject.' })
    }

    const note = await Note.create({
      title: title.trim(),
      subject,
      description,
      fileUrl: `/uploads/${req.file.filename}`,
      originalName: req.file.originalname,
      fileSize: req.file.size,
      uploadedBy: req.userId
    })

    // Index PDF for RAG vector search in background
    indexPdfFileForDocument({ documentId: note._id, filePath: req.file.path }).catch(err => {
      console.warn(`[Note RAG Indexing Error for ${note._id}]:`, err.message)
    })

    res.status(201).json({ note })
  } catch(e) {
    if (req.file) await fs.unlink(req.file.path).catch(() => {})
    next(e)
  }
}

export async function deleteNote(req, res, next) {
  try {
    const note = await Note.findById(req.params.id)
    if (!note) return res.status(404).json({ message: 'Note not found.' })
    await fs.unlink(path.join('uploads', path.basename(note.fileUrl))).catch(() => {})
    await Promise.all([
      AiPage.deleteMany({ documentId: note._id }),
      AiChunk.deleteMany({ documentId: note._id }),
      note.deleteOne()
    ])
    res.json({ message: 'Note deleted.' })
  } catch(e) {
    next(e)
  }
}
