import { createContext, useContext, useState, useEffect, useCallback } from 'react'
import { askAiQuestion } from '../services/aiService'
import { api } from '../services/api'
import { subjects as studentSubjects } from '../data/subjects'

const ChatContext = createContext(null)
const STORAGE_KEY = 'campus_ai_chat'

const getStoredState = () => {
  try {
    if (typeof sessionStorage === 'undefined' || typeof localStorage === 'undefined') return null
    const raw = sessionStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw)
    const userRaw = localStorage.getItem('campus_user')
    const user = userRaw ? JSON.parse(userRaw) : {}
    const token = localStorage.getItem('campus_token')
    if (token && parsed && parsed.userId === user._id) {
      return parsed
    }
  } catch {}
  return null
}

export function ChatProvider({ children }) {
  const initial = getStoredState()

  const [notes, setNotes] = useState([])
  const [backendSubjects, setBackendSubjects] = useState([])
  const [selectedSubject, setSelectedSubject] = useState(
    initial?.selectedSubject || studentSubjects[0] || 'DSP — Digital Signal Processing'
  )
  const [selectedDocId, setSelectedDocId] = useState(initial?.selectedDocId || '')
  const [messages, setMessages] = useState(initial?.messages || [])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [question, setQuestion] = useState('')

  // Persist to sessionStorage for the active user session
  useEffect(() => {
    try {
      const userRaw = localStorage.getItem('campus_user')
      const user = userRaw ? JSON.parse(userRaw) : {}
      const token = localStorage.getItem('campus_token')
      if (token && user._id) {
        sessionStorage.setItem(
          STORAGE_KEY,
          JSON.stringify({
            userId: user._id,
            selectedDocId,
            selectedSubject,
            messages
          })
        )
      }
    } catch {}
  }, [messages, selectedDocId, selectedSubject])

  // Fetch available notes
  const fetchNotes = useCallback(async () => {
    try {
      const res = await api('/notes')
      if (res.notes) setNotes(res.notes)
      if (res.subjects) setBackendSubjects(res.subjects)
    } catch {}
  }, [])

  // Initial fetch of notes
  useEffect(() => {
    fetchNotes()
  }, [fetchNotes])

  // Reset ONLY when a different PDF is explicitly selected
  const selectDocument = useCallback((newDocId) => {
    setSelectedDocId(prev => {
      if (prev === newDocId) return prev
      // On PDF change: clear old chat and start a new chat for the new document
      setMessages([])
      setError('')
      setQuestion('')
      return newDocId
    })
  }, [])

  // Select a subject, and if docId changes as a result, clear old chat
  const selectSubject = useCallback((newSubject, newDocId) => {
    setSelectedSubject(newSubject)
    setSelectedDocId(prev => {
      if (prev === newDocId) return prev
      // On PDF change: clear old chat and start a new chat for the new document
      setMessages([])
      setError('')
      setQuestion('')
      return newDocId
    })
  }, [])

  // Auto-initialize document ONLY if none is currently selected
  const initDocumentIfNone = useCallback((fallbackDocId) => {
    setSelectedDocId(prev => {
      if (!prev && fallbackDocId) {
        return fallbackDocId
      }
      return prev
    })
  }, [])

  // Submit question using RAG
  const askQuestion = useCallback(async (userQuestion, currentDocument) => {
    if (!selectedDocId || !userQuestion.trim() || loading) return

    const trimmedQuestion = userQuestion.trim()
    setError('')
    setQuestion('')
    setMessages(current => [...current, { role: 'user', text: trimmedQuestion }])
    setLoading(true)

    try {
      const response = await askAiQuestion({
        documentId: selectedDocId,
        subjectId: selectedSubject,
        question: trimmedQuestion
      })

      setMessages(current => [
        ...current,
        {
          role: 'assistant',
          text: response.answer || response.reply || 'No answer generated.',
          documentName: response.documentName || currentDocument?.filename,
          documentId: response.documentId || selectedDocId,
          subjectId: response.subjectId || selectedSubject,
          sources: response.sources || []
        }
      ])
    } catch (chatError) {
      setError(chatError.message || 'Failed to get an answer. Please try again.')
    } finally {
      setLoading(false)
    }
  }, [selectedDocId, selectedSubject, loading])

  // Clear all chat state on logout or explicit reset
  const clearChat = useCallback(() => {
    setMessages([])
    setSelectedDocId('')
    setSelectedSubject(studentSubjects[0] || 'DSP — Digital Signal Processing')
    setLoading(false)
    setError('')
    setQuestion('')
    try {
      sessionStorage.removeItem(STORAGE_KEY)
      localStorage.removeItem(STORAGE_KEY)
    } catch {}
  }, [])

  const value = {
    notes,
    backendSubjects,
    fetchNotes,
    selectedSubject,
    setSelectedSubject,
    selectedDocId,
    setSelectedDocId,
    selectDocument,
    selectSubject,
    initDocumentIfNone,
    messages,
    setMessages,
    loading,
    error,
    setError,
    question,
    setQuestion,
    askQuestion,
    clearChat
  }

  return <ChatContext.Provider value={value}>{children}</ChatContext.Provider>
}

export function useChat() {
  const ctx = useContext(ChatContext)
  if (!ctx) {
    throw new Error('useChat must be used within a ChatProvider')
  }
  return ctx
}
