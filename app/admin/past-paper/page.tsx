'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'

const ADMIN_SECRET_KEY = 'siksha_admin_secret'

const SUBJECTS = [
  { id: 'mathematics', name: 'Mathematics' },
  { id: 'science',     name: 'Science' },
  { id: 'english',     name: 'English' },
  { id: 'nepali',      name: 'Nepali' },
  { id: 'social',      name: 'Social Studies' },
  { id: 'hpe',         name: 'HPE' },
  { id: 'optmath',     name: 'Optional Mathematics' },
  { id: 'computer',    name: 'Computer Science' },
  { id: 'account',     name: 'Account' },
  { id: 'economics',   name: 'Economics' },
]
const GRADES = ['9', '10', 'SEE Prep']
const EXAM_TYPES = ['SEE', 'model', 'pre-board', 'provincial']

const SOURCE_GUIDE = [
  {
    name: 'NEB Item Banking System',
    url: 'https://ibs.neb.gov.np',
    note: 'Official NEB model questions — most authoritative source',
    icon: '🏛️',
  },
  {
    name: 'NEB Official Website',
    url: 'https://www.neb.gov.np',
    note: 'SEE past papers, notices, marking schemes',
    icon: '📋',
  },
  {
    name: 'CDC E-Library',
    url: 'https://lib.moecdc.gov.np',
    note: 'Official Grade 9/10 textbooks as free PDFs',
    icon: '📚',
  },
  {
    name: 'NEB Education',
    url: 'https://www.nebeducation.com',
    note: 'Class 9/10 model questions with solutions (2079–2082)',
    icon: '📝',
  },
  {
    name: 'Educate Nepal',
    url: 'https://www.educatenepal.com',
    note: 'SEE old past papers — all subjects collection',
    icon: '🗂️',
  },
]

interface PaperSummary {
  title: string
  grade: string
  subject_id: string
  year_bs: number
  questionCount: number
  createdAt: string
}

interface IngestResult {
  paperLabel: string
  extracted: number
  saved: number
  errors: number
}

export default function PastPaperPage() {
  const router = useRouter()
  const [secret, setSecret] = useState('')
  const [authed, setAuthed] = useState(false)
  const [checking, setChecking] = useState(true)

  // Form
  const [file, setFile] = useState<File | null>(null)
  const [grade, setGrade] = useState('10')
  const [subjectId, setSubjectId] = useState('mathematics')
  const [yearBs, setYearBs] = useState('2083')
  const [examYear, setExamYear] = useState('2079 BS')
  const [examType, setExamType] = useState('SEE')
  const fileRef = useRef<HTMLInputElement>(null)

  // State
  const [uploading, setUploading] = useState(false)
  const [result, setResult] = useState<IngestResult | null>(null)
  const [error, setError] = useState('')

  // Papers list
  const [papers, setPapers] = useState<PaperSummary[]>([])
  const [loadingPapers, setLoadingPapers] = useState(false)

  useEffect(() => {
    const stored = sessionStorage.getItem(ADMIN_SECRET_KEY)
    if (!stored) { setChecking(false); return }
    fetch('/api/admin/usage-stats', { headers: { 'x-admin-secret': stored } })
      .then(r => {
        if (r.ok) { setSecret(stored); setAuthed(true) }
        else sessionStorage.removeItem(ADMIN_SECRET_KEY)
      })
      .catch(() => sessionStorage.removeItem(ADMIN_SECRET_KEY))
      .finally(() => setChecking(false))
  }, [])

  const adminHeaders = useCallback(() => ({ 'x-admin-secret': secret }), [secret])

  const loadPapers = useCallback(async () => {
    setLoadingPapers(true)
    try {
      const res = await fetch('/api/admin/past-paper', { headers: adminHeaders() })
      const data = await res.json()
      setPapers(data.papers ?? [])
    } finally {
      setLoadingPapers(false)
    }
  }, [adminHeaders])

  useEffect(() => {
    if (authed) loadPapers()
  }, [authed, loadPapers])

  const handleLogin = async () => {
    const res = await fetch('/api/admin/usage-stats', { headers: { 'x-admin-secret': secret } })
    if (!res.ok) { alert('Invalid admin secret.'); return }
    sessionStorage.setItem(ADMIN_SECRET_KEY, secret)
    setAuthed(true)
  }

  const handleUpload = async () => {
    if (!file) { setError('Select a PDF first'); return }
    setUploading(true)
    setError('')
    setResult(null)

    const form = new FormData()
    form.append('file', file)
    form.append('grade', grade)
    form.append('subjectId', subjectId)
    form.append('yearBs', yearBs)
    form.append('examYear', examYear)
    form.append('examType', examType)

    try {
      const res = await fetch('/api/admin/past-paper', {
        method: 'POST',
        headers: adminHeaders(),
        body: form,
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error || 'Upload failed'); return }
      setResult(data)
      setFile(null)
      if (fileRef.current) fileRef.current.value = ''
      await loadPapers()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed')
    } finally {
      setUploading(false)
    }
  }

  if (checking) return <div className="min-h-screen bg-stone-50" />

  if (!authed) {
    return (
      <div className="min-h-screen bg-stone-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl border border-stone-200 shadow-sm p-8 w-full max-w-sm space-y-4">
          <h1 className="text-lg font-bold text-stone-900">Admin Access</h1>
          <input type="password" placeholder="Admin secret" value={secret} onChange={e => setSecret(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleLogin()}
            className="w-full border border-stone-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-green-500" />
          <button onClick={handleLogin} className="w-full bg-green-600 text-white rounded-xl py-2.5 text-sm font-semibold hover:bg-green-700">Sign in</button>
          <button onClick={() => router.push('/admin')} className="w-full text-stone-500 text-sm hover:text-stone-700">Back to admin</button>
        </div>
      </div>
    )
  }

  const totalQuestions = papers.reduce((s, p) => s + p.questionCount, 0)

  return (
    <div className="min-h-screen bg-stone-50 p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-stone-900">Past Paper Ingestion</h1>
          <p className="text-sm text-stone-500 mt-0.5">
            Upload real SEE exam papers — Claude extracts every question and loads them into RAG
          </p>
        </div>
        <button onClick={() => router.push('/admin')} className="text-sm text-stone-500 hover:text-stone-700 border border-stone-200 rounded-xl px-4 py-2">
          Back to admin
        </button>
      </div>

      {/* Why this matters */}
      <div className="bg-blue-50 border border-blue-200 rounded-2xl p-5">
        <h2 className="text-sm font-semibold text-blue-900 mb-2">Why past papers are the strongest knowledge source</h2>
        <ul className="text-sm text-blue-800 space-y-1">
          <li>The AI can reference exact questions: <em>&quot;This appeared in the 2079 SEE exam for 4 marks&quot;</em></li>
          <li>Students see the actual exam format, not AI-guessed examples</li>
          <li>Pattern analysis across years shows what topics are tested every year</li>
          <li>Marking scheme content tells the AI exactly what answer format scores full marks</li>
          <li>7 years of papers (2075–2082) × 6 subjects = authoritative exam coverage</li>
        </ul>
      </div>

      {/* Where to get papers */}
      <div className="bg-white rounded-2xl border border-stone-200 shadow-sm p-5 space-y-3">
        <h2 className="font-semibold text-stone-900">Where to download papers</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {SOURCE_GUIDE.map((src) => (
            <a key={src.url} href={src.url} target="_blank" rel="noreferrer"
              className="flex items-start gap-3 p-3 rounded-xl border border-stone-100 hover:border-stone-300 hover:bg-stone-50 transition-colors group">
              <span className="text-xl shrink-0">{src.icon}</span>
              <div className="min-w-0">
                <p className="text-xs font-semibold text-stone-800 group-hover:text-green-700">{src.name} ↗</p>
                <p className="text-xs text-stone-500 mt-0.5">{src.note}</p>
              </div>
            </a>
          ))}
        </div>
        <p className="text-xs text-stone-400 pt-1">
          Download the PDF, then upload it below. Claude reads the full PDF natively — no OCR needed.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Upload form */}
        <div className="bg-white rounded-2xl border border-stone-200 shadow-sm p-5 space-y-4">
          <h2 className="font-semibold text-stone-900">Upload a paper</h2>

          {/* File drop */}
          <div
            onClick={() => fileRef.current?.click()}
            className={[
              'border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-colors',
              file ? 'border-green-400 bg-green-50' : 'border-stone-200 hover:border-stone-400',
            ].join(' ')}
          >
            <input ref={fileRef} type="file" accept=".pdf,application/pdf" className="hidden"
              onChange={e => setFile(e.target.files?.[0] ?? null)} />
            {file ? (
              <div>
                <p className="text-sm font-medium text-green-700">{file.name}</p>
                <p className="text-xs text-green-600 mt-0.5">{(file.size / 1024).toFixed(0)} KB</p>
              </div>
            ) : (
              <div>
                <p className="text-sm text-stone-500">Click to select a PDF</p>
                <p className="text-xs text-stone-400 mt-1">SEE past paper, model question, or marking scheme</p>
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-stone-600 mb-1 block">Grade</label>
              <select value={grade} onChange={e => setGrade(e.target.value)}
                className="w-full border border-stone-200 rounded-xl px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-green-500">
                {GRADES.map(g => <option key={g} value={g}>{g}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-stone-600 mb-1 block">Subject</label>
              <select value={subjectId} onChange={e => setSubjectId(e.target.value)}
                className="w-full border border-stone-200 rounded-xl px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-green-500">
                {SUBJECTS.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-stone-600 mb-1 block">Exam Year</label>
              <input value={examYear} onChange={e => setExamYear(e.target.value)} placeholder="2079 BS"
                className="w-full border border-stone-200 rounded-xl px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-green-500" />
            </div>
            <div>
              <label className="text-xs font-medium text-stone-600 mb-1 block">Exam Type</label>
              <select value={examType} onChange={e => setExamType(e.target.value)}
                className="w-full border border-stone-200 rounded-xl px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-green-500">
                {EXAM_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div className="col-span-2">
              <label className="text-xs font-medium text-stone-600 mb-1 block">Curriculum Year BS</label>
              <input value={yearBs} onChange={e => setYearBs(e.target.value)} placeholder="2083"
                className="w-full border border-stone-200 rounded-xl px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-green-500" />
            </div>
          </div>

          {error && <p className="text-sm text-red-600 bg-red-50 rounded-xl px-3 py-2">{error}</p>}

          {result && (
            <div className="bg-green-50 border border-green-200 rounded-xl p-4 space-y-1">
              <p className="text-sm font-semibold text-green-800">{result.paperLabel}</p>
              <p className="text-sm text-green-700">
                Extracted {result.extracted} questions, saved {result.saved} to RAG
                {result.errors > 0 && ` (${result.errors} errors)`}
              </p>
            </div>
          )}

          <button onClick={handleUpload} disabled={uploading || !file}
            className="w-full bg-green-600 text-white rounded-xl py-2.5 text-sm font-semibold hover:bg-green-700 disabled:opacity-50">
            {uploading ? 'Parsing & ingesting...' : 'Parse & ingest paper'}
          </button>
          <p className="text-xs text-stone-400">
            Claude reads the entire PDF and extracts every question. Takes 15–30 seconds per paper.
          </p>
        </div>

        {/* Papers already ingested */}
        <div className="bg-white rounded-2xl border border-stone-200 shadow-sm p-5 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-stone-900">Papers in RAG</h2>
            <div className="flex items-center gap-3">
              <span className="text-xs text-stone-500">{totalQuestions} questions total</span>
              <button onClick={loadPapers} className="text-xs text-stone-400 hover:text-stone-600">Refresh</button>
            </div>
          </div>

          {loadingPapers && <p className="text-xs text-stone-400">Loading...</p>}

          {papers.length === 0 && !loadingPapers && (
            <div className="text-center py-8 text-stone-400">
              <p className="text-sm">No papers ingested yet.</p>
              <p className="text-xs mt-1">Upload your first SEE past paper to get started.</p>
            </div>
          )}

          <div className="space-y-2 max-h-96 overflow-y-auto">
            {papers.map((p) => (
              <div key={p.title} className="flex items-center justify-between gap-3 p-3 rounded-xl bg-stone-50">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-stone-800 truncate">{p.title}</p>
                  <p className="text-xs text-stone-400">{p.subject_id} · {p.grade} · {p.year_bs} BS</p>
                </div>
                <span className="text-xs font-medium text-green-700 bg-green-100 px-2 py-0.5 rounded-full shrink-0">
                  {p.questionCount}Q
                </span>
              </div>
            ))}
          </div>

          {papers.length > 0 && (
            <div className="pt-2 border-t border-stone-100">
              <p className="text-xs text-stone-400">
                Each question is searchable via RAG. The AI tutor can now reference specific exam questions when students ask about these topics.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Recommended upload order */}
      <div className="bg-white rounded-2xl border border-stone-200 shadow-sm p-5">
        <h2 className="font-semibold text-stone-900 mb-3">Recommended upload priority</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
          {[
            { priority: '1st', what: 'SEE 2079–2082 Mathematics papers', why: 'Highest-stakes subject, most questions asked by students' },
            { priority: '2nd', what: 'SEE 2079–2082 Science papers', why: 'Complex topics, students most confused' },
            { priority: '3rd', what: 'NEB Model Questions 2082 (all subjects)', why: 'Most current, directly reflects what students will face' },
            { priority: '4th', what: 'SEE 2075–2078 papers', why: 'Pattern analysis — shows what gets tested every year vs. occasionally' },
            { priority: '5th', what: 'Marking schemes / answer keys', why: 'Tells the AI what answer format scores full marks' },
            { priority: '6th', what: 'English & Nepali papers', why: 'Writing tasks and grammar questions benefit from real examples' },
          ].map((row) => (
            <div key={row.priority} className="flex gap-3 p-3 rounded-xl bg-stone-50">
              <span className="text-xs font-bold text-green-700 bg-green-100 px-2 py-0.5 rounded-full h-fit shrink-0">{row.priority}</span>
              <div>
                <p className="text-xs font-semibold text-stone-700">{row.what}</p>
                <p className="text-xs text-stone-500 mt-0.5">{row.why}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
