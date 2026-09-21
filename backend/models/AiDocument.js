import mongoose from 'mongoose'

const aiDocumentSchema = new mongoose.Schema({
  originalName: { type: String, required: true, trim: true },
  storageKey:   { type: String, required: true, unique: true },
  mimeType:     { type: String, required: true, enum: ['application/pdf'] },
  fileSize:     { type: Number, required: true },
  uploadedBy:   { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  subjectId:    { type: String, required: true, trim: true, default: 'General', index: true },

  // Extraction lifecycle
  // 'processing' → text is being extracted
  // 'ready'      → pages stored in AiPage collection, ready for RAG
  // 'failed'     → extraction threw; see extractionError for the reason
  status:          { type: String, enum: ['processing', 'ready', 'failed'], default: 'processing' },
  pageCount:       { type: Number },          // total pages successfully extracted
  chunkCount:      { type: Number },          // total chunks created
  extractionError: { type: String },          // populated only when status === 'failed'

  // Embedding metadata
  embeddingProvider:   { type: String, default: 'ollama' },
  embeddingModel:      { type: String, default: 'nomic-embed-text' },
  embeddingDimensions: { type: Number, default: 768 }
}, { timestamps: true })

export default mongoose.model('AiDocument', aiDocumentSchema)

