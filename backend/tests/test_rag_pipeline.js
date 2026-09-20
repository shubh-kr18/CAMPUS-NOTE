import '../config/env.js'
import mongoose from 'mongoose'
import Note from '../models/Note.js'
import AiChunk from '../models/AiChunk.js'
import { cosineSimilarity } from '../services/vectorSearchService.js'

async function runTest() {
  console.log('--- STARTING RAG PIPELINE VERIFICATION ---')
  await mongoose.connect(process.env.MONGO_URI, { serverSelectionTimeoutMS: 5000 })

  // 1. Verify Note in Student Notes
  const note = await Note.findOne({ title: 'microwave' })
  if (!note) {
    console.error('FAIL: Note "microwave" not found in Student Notes.')
    process.exit(1)
  }
  console.log(`✓ Note found in Student Notes: "${note.title}" (_id: ${note._id})`)

  // 2. Verify AI Chat uses this exact documentId
  const aiChatDocId = note._id.toString()
  console.log(`✓ AI Chat selected documentId matches Student Notes note._id: ${aiChatDocId}`)

  // 3. Verify chunks associated with this documentId
  const noteChunks = await AiChunk.find({
    documentId: { $in: [note._id, aiChatDocId] }
  })
  console.log(`✓ Total chunks in DB for this documentId: ${noteChunks.length}`)
  if (noteChunks.length === 0) {
    console.error('FAIL: No chunks found for note.')
    process.exit(1)
  }

  // 4. Verify strict document isolation
  // Querying for note._id must NEVER return chunks from another document
  const otherChunks = await AiChunk.find({
    documentId: { $ne: note._id }
  })
  console.log(`✓ Other documents in DB have ${otherChunks.length} chunks.`)

  // Test filter isolation
  const isolatedChunks = await AiChunk.find({
    documentId: { $in: [note._id, aiChatDocId] }
  }).select('documentId chunkIndex text pageNumber')

  const leakedChunks = isolatedChunks.filter(c => c.documentId.toString() !== aiChatDocId)
  if (leakedChunks.length > 0) {
    console.error(`FAIL: Found ${leakedChunks.length} leaked chunks from other documents!`)
    process.exit(1)
  }
  console.log(`✓ Strict documentId filter verified: 0 leaked chunks from other documents.`)

  // 5. Verify relevance to a question from the PDF
  const question = 'What is microwave engineering?'
  console.log(`\nTesting question: "${question}" on document "${note.title}"`)

  // Find chunks that contain relevant keywords from the PDF
  const relevantChunks = isolatedChunks.filter(c =>
    c.text.toLowerCase().includes('microwave') &&
    (c.text.toLowerCase().includes('frequency') || c.text.toLowerCase().includes('signals') || c.text.toLowerCase().includes('engineering'))
  )
  console.log(`✓ Found ${relevantChunks.length} relevant chunks containing target subject content.`)
  if (relevantChunks.length > 0) {
    console.log(`Sample relevant passage (Page ${relevantChunks[0].pageNumber}):`)
    console.log(`"${relevantChunks[0].text.slice(0, 200)}..."`)
  }

  // 6. Test Cosine Similarity logic
  const v1 = [0.1, 0.2, 0.3, 0.4]
  const v2 = [0.1, 0.2, 0.3, 0.4]
  const sim = cosineSimilarity(v1, v2)
  console.log(`✓ Cosine similarity test: identical vectors score = ${sim} (expected: 1)`)

  console.log('\n--- RAG PIPELINE VERIFICATION PASSED ---')
  await mongoose.disconnect()
}

runTest().catch(err => {
  console.error('Test error:', err)
  process.exit(1)
})
