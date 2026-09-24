import mongoose from 'mongoose'

/**
 * Stores a single chunk of text extracted from a PDF page with its embedding vector.
 */
const aiChunkSchema = new mongoose.Schema({
  documentId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'AiDocument',
    required: true,
    index: true
  },
  chunkIndex: {
    type: Number,
    required: true,
    min: 0
  },
  pageNumber: {
    type: Number,
    required: true,
    min: 1
  },
  text: {
    type: String,
    required: true
  },
  charCount: {
    type: Number,
    default: 0
  },
  embedding: {
    type: [Number], // vector embeddings
    default: undefined
  },
  embeddingProvider: {
    type: String,
    index: true
  },
  embeddingModel: {
    type: String
  },
  dimensions: {
    type: Number
  }
}, { timestamps: false })

// Unique chunk per document index
aiChunkSchema.index({ documentId: 1, chunkIndex: 1 }, { unique: true })

export default mongoose.model('AiChunk', aiChunkSchema)
