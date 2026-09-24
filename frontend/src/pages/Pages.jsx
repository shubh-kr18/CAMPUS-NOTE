import { useEffect, useState, useRef, useMemo } from 'react'
import { CalendarDays, Users, Send, Sparkles, FileText, X, Bot, Loader2, ExternalLink, ChevronDown } from 'lucide-react'
import { api } from '../services/api'
import { getDocumentFileUrl } from '../services/aiService'
import { subjects as studentSubjects } from '../data/subjects'
import { useChat } from '../context/ChatContext'


const Loader = () => <p className="mt-6 text-sm text-slate-400">Loading…</p>

export function Attendance() { const [data, setData] = useState(null); useEffect(() => { api('/attendance').then(x => setData(x.attendance)).catch(() => setData([])) }, []); if (!data) return <Loader/>; const avg = Math.round(data.reduce((a, x) => a + x.percentage, 0) / data.length) || 0; return <><p className="text-sm font-semibold text-lime-300">ACADEMIC OVERVIEW</p><h1 className="mt-2 text-3xl font-semibold">Attendance</h1><div className="mt-8 dash-card max-w-sm"><p className="text-sm text-slate-400">Overall attendance</p><p className="mt-1 text-4xl font-semibold text-lime-300">{avg}%</p></div><div className="mt-5 grid gap-4 md:grid-cols-3">{data.map(x => <article key={x.subject} className="dash-card"><p className="font-semibold">{x.subject}</p><p className="mt-5 text-3xl font-semibold text-lime-300">{x.percentage}%</p><div className="mt-4 h-2 overflow-hidden rounded-full bg-white/10"><div className="h-full bg-lime-300" style={{ width: `${x.percentage}%` }}/></div><p className="mt-3 text-sm text-slate-400">{x.attendedClasses}/{x.totalClasses} classes attended</p></article>)}</div></> }

export function Schedule() { const [data, setData] = useState(null); useEffect(() => { api('/schedule').then(x => setData(x.schedule)).catch(() => setData([])) }, []); if (!data) return <Loader/>; return <><p className="text-sm font-semibold text-lime-300">YOUR WEEK</p><h1 className="mt-2 text-3xl font-semibold">Class Schedule</h1><h2 className="mt-9 font-semibold">Today</h2><div className="mt-4 max-w-2xl space-y-3">{data.map((x, i) => <article className="dash-card flex gap-5" key={i}><div className="min-w-24 text-sm font-medium text-lime-300">{x.startTime}<br/><span className="text-slate-500">{x.endTime}</span></div><div className="border-l border-white/10 pl-5"><p className="font-semibold">{x.subject}</p><p className="mt-1 text-sm text-slate-400">{x.day} · {x.room}</p></div></article>)}</div></> }

export function Clubs() { const [data, setData] = useState(null); useEffect(() => { api('/clubs').then(x => setData(x.clubs)).catch(() => setData([])) }, []); if (!data) return <Loader/>; return <><p className="text-sm font-semibold text-lime-300">CAMPUS COMMUNITY</p><h1 className="mt-2 text-3xl font-semibold">Clubs</h1><p className="mt-2 text-slate-400">Explore what’s happening beyond the classroom.</p><div className="mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">{data.map(x => <article className="dash-card" key={x._id || x.name}><div className="grid h-10 w-10 place-items-center rounded-xl bg-white/10 text-lime-300"><Users size={19}/></div><p className="mt-6 text-xs font-semibold uppercase tracking-wider text-lime-300">{x.category}</p><h2 className="mt-2 font-semibold text-white">{x.name}</h2><p className="mt-2 text-sm leading-6 text-slate-400">{x.description}</p><button className="mt-5 text-sm font-semibold text-lime-300">View Details →</button></article>)}</div></> }

const displaySize = bytes => bytes < 1024 * 1024 ? `${Math.max(1, Math.round(bytes / 1024))} KB` : `${(bytes / 1024 / 1024).toFixed(1)} MB`

export function AIChat() {
  const {
    notes,
    backendSubjects,
    fetchNotes,
    selectedSubject,
    selectedDocId,
    selectDocument,
    selectSubject,
    initDocumentIfNone,
    messages,
    loading,
    error,
    question,
    setQuestion,
    askQuestion
  } = useChat()

  const messagesEndRef = useRef(null)

  // Derive unique list of available subjects from student subjects, backend subjects, and notes
  const availableSubjects = useMemo(() => {
    const set = new Set(studentSubjects)
    backendSubjects.forEach(s => { if (s) set.add(s) })
    notes.forEach(note => {
      if (note.subject) {
        set.add(note.subject)
      }
    })
    return Array.from(set)
  }, [backendSubjects, notes])

  // Filter notes by currently selected subject
  const subjectNotes = useMemo(() => {
    return notes.filter(n => n.subject === selectedSubject)
  }, [notes, selectedSubject])

  const selectedNote = useMemo(() => {
    if (subjectNotes.length === 0) return null
    return subjectNotes.find(n => n._id === selectedDocId) || subjectNotes[0] || null
  }, [subjectNotes, selectedDocId])

  const selectedDocument = useMemo(() => {
    if (!selectedNote) return null
    const baseName = selectedNote.originalName || selectedNote.title || 'Document.pdf'
    const pdfFilename = baseName.toLowerCase().endsWith('.pdf') ? baseName : `${baseName}.pdf`
    return {
      documentId: selectedNote._id,
      filename: pdfFilename,
      title: selectedNote.title,
      subjectId: selectedNote.subject,
      fileUrl: selectedNote.fileUrl
    }
  }, [selectedNote])

  useEffect(() => {
    fetchNotes()
  }, [fetchNotes])

  // Validate and sync selectedDocId with available notes under the selected subject
  useEffect(() => {
    if (subjectNotes.length === 0) {
      if (selectedDocId !== null) {
        initDocumentIfNone(null)
      }
    } else {
      const exists = subjectNotes.some(n => n._id === selectedDocId)
      if (!exists) {
        initDocumentIfNone(subjectNotes[0]._id)
      }
    }
  }, [subjectNotes, selectedDocId, initDocumentIfNone])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, loading])

  const handleSubjectChange = e => {
    const newSubject = e.target.value
    const matchingNotes = notes.filter(n => n.subject === newSubject)
    const fallbackDocId = matchingNotes[0]?._id || null
    selectSubject(newSubject, fallbackDocId)
  }

  const handleDocumentChange = e => {
    const newDocId = e.target.value || null
    selectDocument(newDocId)
  }

  const submitQuestion = async event => {
    event.preventDefault()
    const activeDoc = selectedDocument
    if (!activeDoc?.documentId || !question.trim() || loading) return
    askQuestion(question, activeDoc)
  }

  return (
    <div className="flex min-h-[calc(100vh-9rem)] flex-col">
      <header>
        <p className="text-sm font-semibold text-lime-300">STUDY COMPANION</p>
        <h1 className="mt-2 text-3xl font-semibold">Campus Note AI</h1>
        <p className="mt-2 text-slate-400">Select your Subject, choose a course Document, and ask questions with verified PDF citations.</p>
      </header>

      {error && <p className="mt-4 rounded-xl bg-rose-500/10 p-3 text-sm text-rose-200 border border-rose-500/20">{error}</p>}

      {/* Main chat section with Subject -> Document Cascading Selector */}
      <section className="mt-7 flex min-h-[32rem] flex-1 flex-col overflow-hidden rounded-2xl border border-white/10 bg-panel">
        <div className="flex items-center justify-between border-b border-white/10 px-5 py-4">
          <div className="flex items-center gap-3">
            <div className="grid h-8 w-8 place-items-center rounded-lg bg-lime-300 text-slate-900">
              <Bot size={17} />
            </div>
            <div>
              <h2 className="font-semibold">AI Study Chat</h2>
              <p className="text-xs text-slate-400">
                {selectedDocument
                  ? `${selectedSubject} → ${selectedDocument.filename}`
                  : `No PDFs available under ${selectedSubject}`}
              </p>
            </div>
          </div>
        </div>

        {/* Subject -> Document Cascading Selector Bar */}
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-white/10 px-5 py-3 bg-white/[0.02]">
          <div className="flex flex-wrap items-center gap-4 min-w-0">
            {/* Subject Selector */}
            <div className="flex items-center gap-2">
              <label htmlFor="subject-selector" className="text-xs font-bold uppercase tracking-wider text-lime-300 shrink-0">
                Subject:
              </label>
              <div className="relative min-w-[13rem]">
                <select
                  id="subject-selector"
                  value={selectedSubject}
                  onChange={handleSubjectChange}
                  className="w-full appearance-none rounded-xl border border-white/15 bg-white/10 py-1.5 pl-3 pr-8 text-sm font-medium text-white outline-none focus:border-lime-300 focus:ring-1 focus:ring-lime-300 transition cursor-pointer"
                >
                  {availableSubjects.map(subj => (
                    <option key={subj} value={subj} className="bg-slate-900 text-white">
                      {subj}
                    </option>
                  ))}
                </select>
                <ChevronDown size={15} className="pointer-events-none absolute right-2.5 top-2.5 text-slate-400" />
              </div>
            </div>

            {/* Document Selector */}
            <div className="flex items-center gap-2">
              <label htmlFor="document-selector" className="text-xs font-bold uppercase tracking-wider text-lime-300 shrink-0">
                Document:
              </label>
              <div className="relative min-w-[15rem] max-w-sm">
                <select
                  id="document-selector"
                  value={selectedDocId || ''}
                  onChange={handleDocumentChange}
                  disabled={subjectNotes.length === 0}
                  className="w-full appearance-none rounded-xl border border-white/15 bg-white/10 py-1.5 pl-3 pr-8 text-sm font-medium text-white outline-none focus:border-lime-300 focus:ring-1 focus:ring-lime-300 transition cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {subjectNotes.length === 0 ? (
                    <option value="" className="bg-slate-900 text-slate-400">
                      (No PDFs found for this subject)
                    </option>
                  ) : (
                    subjectNotes.map(note => (
                      <option key={note._id} value={note._id} className="bg-slate-900 text-white">
                        {note.title || note.originalName}
                      </option>
                    ))
                  )}
                </select>
                <ChevronDown size={15} className="pointer-events-none absolute right-2.5 top-2.5 text-slate-400" />
              </div>
            </div>
          </div>

          <span className="text-xs text-slate-400 hidden lg:inline">
            Vector search strictly isolated to selected document
          </span>
        </div>

        <div className="flex-1 space-y-4 p-5 overflow-y-auto max-h-[34rem]">
          {!selectedDocument ? (
            <div className="grid h-full place-items-center text-center py-12">
              <div>
                <Sparkles className="mx-auto text-lime-300" />
                <p className="mt-4 font-medium">No documents available for {selectedSubject}.</p>
                <p className="mt-1 max-w-sm text-sm leading-6 text-slate-400">
                  Course PDFs are uploaded via Student Notes. Select another subject above to ask questions.
                </p>
              </div>
            </div>
          ) : messages.length === 0 ? (
            <div className="grid h-full place-items-center text-center py-12">
              <div className="max-w-md">
                <div className="mx-auto mb-3 grid h-12 w-12 place-items-center rounded-2xl bg-lime-300/10 text-lime-300">
                  <Sparkles size={24} />
                </div>
                <p className="text-base font-semibold text-white">Ask anything about &ldquo;{selectedDocument.filename}&rdquo;</p>
                <p className="mt-1 text-sm text-slate-400 leading-relaxed">
                  Questions are answered strictly using retrieved passages from this document.
                </p>
                <div className="mt-4 flex flex-wrap justify-center gap-2">
                  {['Summarize this document', 'What are the main concepts?', 'Explain key terms in simple words'].map(prompt => (
                    <button
                      key={prompt}
                      type="button"
                      onClick={() => setQuestion(prompt)}
                      className="text-xs bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg px-3 py-1.5 text-slate-300 transition hover:border-lime-300/40"
                    >
                      &ldquo;{prompt}&rdquo;
                    </button>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <>
              {messages.map((message, index) =>
                message.role === 'user' ? (
                  <div key={index} className="ml-auto max-w-xl rounded-2xl bg-lime-300 p-3.5 text-sm text-slate-900 shadow-sm">
                    <p className="mb-1 text-[11px] font-bold uppercase tracking-wider text-slate-800">You</p>
                    <div className="whitespace-pre-wrap leading-relaxed">{message.text}</div>
                  </div>
                ) : (
                  <div key={index} className="flex items-start gap-3 max-w-2xl">
                    <div className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-lime-300 text-slate-900">
                      <Bot size={17} />
                    </div>
                    <div className="rounded-2xl bg-white/10 p-4 text-sm text-slate-200 border border-white/5 shadow-sm">
                      <p className="font-semibold text-lime-300 mb-1.5 text-xs uppercase tracking-wider">Campus Note AI</p>
                      <div className="whitespace-pre-wrap leading-relaxed">{message.text}</div>
                      {message.sources && message.sources.length > 0 && (
                        <div className="mt-4 border-t border-white/10 pt-3">
                          <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-2">Sources:</p>
                          <div className="rounded-xl border border-white/10 bg-white/5 p-3 space-y-2.5">
                            <div className="flex items-center gap-2 text-xs font-semibold text-slate-200">
                              <FileText size={15} className="text-rose-300 shrink-0" />
                              <span className="truncate">{message.documentName || selectedDocument?.filename || 'Document.pdf'}</span>
                            </div>
                            <div className="flex flex-wrap items-center gap-2 pl-5">
                              {message.sources.map((source, sIdx) => {
                                if (typeof source.pageNumber !== 'number') return null
                                const fileUrl = getDocumentFileUrl(
                                  source.documentId || message.documentId || selectedDocId,
                                  source.pageNumber
                                )
                                return (
                                  <a
                                    key={sIdx}
                                    href={fileUrl}
                                    target="_blank"
                                    rel="noreferrer"
                                    title={`Open ${message.documentName || 'Document'} at Page ${source.pageNumber}`}
                                    className="inline-flex items-center gap-1.5 rounded-lg bg-lime-300/15 px-2.5 py-1 text-xs font-semibold text-lime-300 border border-lime-300/30 hover:bg-lime-300 hover:text-slate-900 transition-colors"
                                  >
                                    <span>Page {source.pageNumber}</span>
                                    <ExternalLink size={12} className="shrink-0" />
                                  </a>
                                )
                              })}
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )
              )}

              {loading && (
                <div className="flex items-start gap-3 max-w-2xl">
                  <div className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-lime-300 text-slate-900">
                    <Bot size={17} />
                  </div>
                  <div className="rounded-2xl bg-white/10 p-4 text-sm text-slate-200 border border-white/5">
                    <p className="flex items-center gap-2 font-medium text-slate-300">
                      <Loader2 className="animate-spin text-lime-300" size={16} />
                      <span>Searching &ldquo;{selectedDocument?.filename}&rdquo; &amp; generating answer&hellip;</span>
                    </p>
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </>
          )}
        </div>

        <form onSubmit={submitQuestion} className="flex gap-3 border-t border-white/10 p-4">
          <input
            disabled={!selectedDocId || loading}
            className="w-full rounded-xl bg-white/10 px-4 py-3 text-sm outline-none ring-lime-300 placeholder:text-slate-500 focus:ring-2 disabled:cursor-not-allowed disabled:opacity-50"
            placeholder={
              selectedDocument
                ? loading
                  ? 'Waiting for answer…'
                  : `Ask about ${selectedDocument.filename}...`
                : 'Select a subject and document above to ask questions'
            }
            value={question}
            onChange={event => setQuestion(event.target.value)}
          />
          <button
            disabled={!selectedDocId || !question.trim() || loading}
            className="btn-primary flex items-center justify-center disabled:cursor-not-allowed disabled:opacity-50"
            aria-label="Send question"
          >
            {loading ? <Loader2 className="animate-spin" size={18} /> : <Send size={18} />}
          </button>
        </form>
      </section>
    </div>
  )
}


export function Settings() { const u = JSON.parse(localStorage.getItem('campus_user') || '{}'); return <><p className="text-sm font-semibold text-lime-300">PREFERENCES</p><h1 className="mt-2 text-3xl font-semibold">Settings</h1><div className="mt-8 max-w-2xl space-y-4">{[['Profile', `${u.name || 'Student'} · ${u.branch || 'IIIT Bhopal'}`], ['Appearance', 'Charcoal dashboard theme is active.'], ['Notifications', 'Manage your study reminders and updates here soon.']].map(([t, d]) => <section key={t} className="dash-card"><h2 className="font-semibold text-white">{t}</h2><p className="mt-2 text-sm text-slate-400">{d}</p></section>)}</div></> }
