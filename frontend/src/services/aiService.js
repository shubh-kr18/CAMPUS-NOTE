import { api, API_URL } from './api'

/**
 * Lists all indexed documents uploaded by the student, optionally filtered by subjectId.
 * Route: GET /api/ai/documents
 */
export const listAiDocuments = subjectId =>
  api(subjectId ? `/ai/documents?subjectId=${encodeURIComponent(subjectId)}` : '/ai/documents')

/**
 * Deletes an indexed document by ID.
 * Route: DELETE /api/ai/documents/:id
 */
export const removeAiDocument = id => api(`/ai/documents/${id}`, { method: 'DELETE' })

/**
 * Sends a student's question and selected documentId to the backend RAG API.
 * Route: POST /api/ai/chat
 *
 * @param {Object} params
 * @param {string} params.documentId - Uploaded PDF document ID.
 * @param {string} params.question - The question text.
 * @returns {Promise<{ answer: string, documentId: string, documentName: string, sources: Array<{ documentId: string, documentName: string, pageNumber: number }> }>}
 */
export const askAiQuestion = ({ documentId, subjectId, question }) =>
  api('/ai/chat', {
    method: 'POST',
    body: JSON.stringify({ documentId, subjectId, question })
  })

export const sendMessage = (message, documentId) =>
  askAiQuestion({ documentId, question: message })

/**
 * Constructs an authenticated URL to view an uploaded AI PDF document,
 * deep-linking directly to a target pageNumber via #page=N hash.
 *
 * @param {string} documentId
 * @param {number} [pageNumber]
 * @returns {string} URL
 */
export const getDocumentFileUrl = (documentId, pageNumber) => {
  const token = localStorage.getItem('campus_token')
  const base = `${API_URL}/ai/documents/${documentId}/file`
  const query = token ? `?token=${encodeURIComponent(token)}` : ''
  const hash = pageNumber ? `#page=${pageNumber}` : ''
  return `${base}${query}${hash}`
}
