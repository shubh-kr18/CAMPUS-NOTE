import mongoose from 'mongoose'

/**
 * Stores extracted text for a single page of an uploaded AI document.
 * One document produces N AiPage records — one per PDF page.
 *
 * Index strategy:
 *  - documentId is indexed for fast retrieval of all pages for a document.
 *  - { documentId, pageNumber } is unique to prevent duplicate page inserts
 *    if extraction is ever retried.
 */
const aiPageSchema = new mongoose.Schema({
  documentId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'AiDocument',
    required: true,
    index: true
  },
  pageNumber: {
    type: Number,
    required: true,
    min: 1
  },
  text: {
    type: String,
    default: ''    // empty string for image-only / blank pages
  },
  charCount: {
    type: Number,
    required: true,
    default: 0
  }
}, { timestamps: false })

// Prevent duplicate pages if createAiDocument is ever called twice for the same doc
aiPageSchema.index({ documentId: 1, pageNumber: 1 }, { unique: true })

export default mongoose.model('AiPage', aiPageSchema)
