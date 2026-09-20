import '../config/env.js'
import { getOllamaConfig, isOllamaConnectionError, OLLAMA_NOT_RUNNING_MESSAGE } from '../config/env.js'
import { answerQuestionWithRag } from '../services/aiService.js'

/**
 * Handles RAG chat requests for uploaded PDF documents.
 * Route: POST /api/ai/chat
 * Protected by: protect middleware
 */
export async function chat(req, res, next) {
  try {
    const documentId = req.body.documentId
    const question = req.body.question || req.body.message

    if (!documentId) {
      return res.status(400).json({ message: 'documentId is required.' })
    }
    if (!question || typeof question !== 'string' || !question.trim()) {
      return res.status(400).json({ message: 'Please enter a question.' })
    }

    const topK = req.body.topK ? parseInt(req.body.topK, 10) : 5
    const subjectId = req.body.subjectId || req.body.subject

    const result = await answerQuestionWithRag({
      documentId,
      subjectId,
      question: question.trim(),
      topK,
      userId: req.userId,
      userRole: req.user?.role
    })

    console.log('[RAG DEBUG Stage 7] Response sent to React:', {
      documentId: result.documentId,
      documentName: result.documentName,
      sourcesCount: result.sources?.length || 0,
      answerLength: result.answer?.length || 0
    })

    res.json({
      answer: result.answer,
      reply: result.answer, // backwards compatibility
      documentId: result.documentId,
      subjectId: result.subjectId,
      documentName: result.documentName,
      sources: result.sources
    })
  } catch (error) {
    console.error('[RAG Error]:', error.message)

    // Return clean message if Ollama cannot be reached
    if (isOllamaConnectionError(error) || error.message === OLLAMA_NOT_RUNNING_MESSAGE) {
      return res.status(503).json({
        message: OLLAMA_NOT_RUNNING_MESSAGE
      })
    }

    // Never expose stack traces or internal errors to the frontend
    if (error.status && error.status >= 400 && error.status < 500) {
      return res.status(error.status).json({ message: error.message })
    }

    return res.status(500).json({
      message: 'Something went wrong while processing your question. Please try again.'
    })
  }
}
/**
 * Health check endpoint for local Ollama configuration.
 * Route: GET /api/ai/status
 */
export async function checkAiStatus(req, res) {
  const { baseUrl, model, embeddingModel } = getOllamaConfig()
  let ollamaReady = false

  try {
    const checkRes = await fetch(`${baseUrl}/api/tags`, { signal: AbortSignal.timeout(3000) })
    if (checkRes.ok) {
      const data = await checkRes.json()
      const models = (data.models || []).map(m => m.name)
      ollamaReady = models.some(m => m.includes(model)) && models.some(m => m.includes(embeddingModel))
    }
  } catch {
    ollamaReady = false
  }

  res.json({
    ollamaReady,
    provider: 'ollama',
    baseUrl,
    chatModel: model,
    embeddingModel
  })
}
