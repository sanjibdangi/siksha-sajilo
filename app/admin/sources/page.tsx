'use client'

import { useState, useRef, useEffect, Suspense } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'

const ADMIN_SECRET_KEY = 'siksha_admin_secret'

const SUBJECT_NAMES: Record<string, string> = {
  mathematics: 'Mathematics',
  science: 'Science',
  english: 'English',
  nepali: 'Nepali',
  social: 'Social Studies',
  hpe: 'HPE',
  optmath: 'Optional Maths',
  computer: 'Computer',
  account: 'Account',
  economics: 'Economics',
}

type SourceType = 'youtube' | 'pdf' | 'docx' | 'text'

const SOURCE_TYPES: { id: SourceType; label: string; icon: string; desc: string; accept?: string }[] = [
  { id: 'youtube', label: 'YouTube URL', icon: '▶️', desc: 'Paste a YouTube video link — transcript extracted automatically' },
  { id: 'pdf',     label: 'PDF',         icon: '📄', desc: 'Upload a PDF — textbook page, notes, past paper', accept: '.pdf' },
  { id: 'docx',    label: 'Word / DOCX', icon: '📝', desc: 'Upload a .docx Word document', accept: '.docx,.doc' },
  { id: 'text',    label: 'Plain text',  icon: '📋', desc: 'Paste or upload raw text — any format', accept: '.txt,.md,.csv' },
]

function SourcesPageInner() {
  const params = useSearchParams()
  const adminSecret = typeof window !== 'undefined' ? sessionStorage.getItem(ADMIN_SECRET_KEY) : null

  // Pre-fill from insights page query params
  const [grade, setGrade]         = useState(params.get('grade') ?? '9')
  const [subjectId, setSubjectId] = useState(params.get('subject') ?? 'science')
  const [topicInput, setTopicInput] = useState(params.get('topic') ?? '')
  const [yearBs, setYearBs]       = useState('2082')
  const [title, setTitle]         = useState('')

  const [sourceType, setSourceType] = useState<SourceType>('youtube')
  const [url, setUrl]               = useState('')
  const [file, setFile]             = useState<File | null>(null)
  const [pastedText, setPastedText] = useState('')

  const [extracting, setExtracting] = useState(false)
  const [extractError, setExtractError] = useState('')
  const [extracted, setExtracted]   = useState<{ text: string; wordCount: number } | null>(null)

  const [saving, setSaving]         = useState(false)
  const [saved, setSaved]           = useState(false)
  const [saveError, setSaveError]   = useState('')

  const fileInputRef = useRef<HTMLInputElement>(null)

  // Reset extraction when source type changes
  useEffect(() => {
    setExtracted(null)
    setExtractError('')
    setUrl('')
    setFile(null)
    setPastedText('')
  }, [sourceType])

  if (!adminSecret) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center space-y-3">
          <p className="text-gray-600">Session expired.</p>
          <Link href="/admin" className="text-indigo-600 hover:underline text-sm">Back to admin login</Link>
        </div>
      </div>
    )
  }

  async function handleExtract() {
    setExtractError('')
    setExtracted(null)
    setExtracting(true)

    try {
      let res: Response

      if (sourceType === 'youtube') {
        if (!url.trim()) { setExtractError('Paste a YouTube URL first.'); setExtracting(false); return }
        res = await fetch('/api/sources/extract', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ url: url.trim() }),
        })
      } else if (sourceType === 'text' && !file) {
        // Plain text pasted directly
        if (!pastedText.trim()) { setExtractError('Paste or type some text first.'); setExtracting(false); return }
        const wordCount = pastedText.trim().split(/\s+/).length
        setExtracted({ text: pastedText.trim(), wordCount })
        setExtracting(false)
        return
      } else {
        if (!file) { setExtractError('Select a file first.'); setExtracting(false); return }
        const form = new FormData()
        form.append('file', file)
        form.append('sourceType', sourceType)
        res = await fetch('/api/sources/extract', { method: 'POST', body: form })
      }

      const data = await res.json()
      if (!res.ok) { setExtractError(data.error ?? 'Extraction failed'); return }
      setExtracted({ text: data.text, wordCount: data.wordCount })
    } catch {
      setExtractError('Network error — please try again.')
    } finally {
      setExtracting(false)
    }
  }

  async function handleSave() {
    if (!extracted) return
    setSaveError('')
    setSaving(true)

    const topicTags = topicInput.split(',').map(t => t.trim()).filter(Boolean)

    try {
      const res = await fetch('/api/sources/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-admin-secret': adminSecret! },
        body: JSON.stringify({
          sourceType,
          title: title || (sourceType === 'youtube' ? url : file?.name) || '',
          sourceUrl: sourceType === 'youtube' ? url : null,
          fileName: file?.name ?? null,
          grade,
          subjectId,
          topicTags,
          yearBs: parseInt(yearBs) || 2082,
          rawContent: extracted.text,
          wordCount: extracted.wordCount,
        }),
      })

      const data = await res.json()
      if (!res.ok) { setSaveError(data.error ?? 'Save failed'); return }
      setSaved(true)
    } catch {
      setSaveError('Network error — please try again.')
    } finally {
      setSaving(false)
    }
  }

  function reset() {
    setExtracted(null)
    setExtractError('')
    setUrl('')
    setFile(null)
    setPastedText('')
    setTitle('')
    setSaved(false)
    setSaveError('')
  }

  const currentType = SOURCE_TYPES.find(s => s.id === sourceType)!
  const canExtract = sourceType === 'youtube' ? url.trim().length > 0
    : sourceType === 'text' ? (pastedText.trim().length > 0 || !!file)
    : !!file

  // ── Success state ──────────────────────────────────────────────────────────
  if (saved) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-10 max-w-md w-full text-center space-y-5">
          <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center mx-auto">
            <svg className="h-8 w-8 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <div>
            <p className="text-lg font-bold text-gray-900">Source saved to knowledge base</p>
            <p className="text-sm text-gray-500 mt-1">
              {extracted?.wordCount?.toLocaleString()} words added for {SUBJECT_NAMES[subjectId]} · {grade === 'SEE Prep' ? 'SEE Prep' : `Class ${grade}`}
            </p>
          </div>
          <div className="flex gap-3">
            <button
              onClick={reset}
              className="flex-1 py-3 rounded-xl border-2 border-gray-200 text-sm font-semibold text-gray-700 hover:border-gray-300 transition-colors"
            >
              Add another source
            </button>
            <Link
              href="/admin/insights"
              className="flex-1 py-3 rounded-xl bg-indigo-600 text-white text-sm font-semibold text-center hover:bg-indigo-700 transition-colors"
            >
              Back to insights
            </Link>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200 px-6 py-4 sticky top-0 z-10">
        <div className="max-w-2xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/admin/insights" className="text-sm text-gray-400 hover:text-gray-600 transition-colors">
              ← Insights
            </Link>
            <span className="text-gray-300">|</span>
            <span className="font-bold text-indigo-600">Add Knowledge Source</span>
          </div>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-8 space-y-6">

        {/* Context badge — pre-filled topic */}
        {params.get('topic') && (
          <div className="flex items-center gap-2 p-3 bg-indigo-50 border border-indigo-200 rounded-xl">
            <svg className="h-4 w-4 text-indigo-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <p className="text-sm text-indigo-700">
              Adding sources for <strong>{params.get('topic')}</strong> · {SUBJECT_NAMES[params.get('subject') ?? ''] ?? params.get('subject')} · {params.get('grade') === 'SEE Prep' ? 'SEE Prep' : `Class ${params.get('grade')}`}
            </p>
          </div>
        )}

        {/* Step 1 — Source type */}
        <section className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm space-y-4">
          <div>
            <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">Step 1</p>
            <h2 className="text-base font-bold text-gray-900 mt-0.5">Choose source type</h2>
          </div>
          <div className="grid grid-cols-2 gap-3">
            {SOURCE_TYPES.map(s => (
              <button
                key={s.id}
                onClick={() => setSourceType(s.id)}
                className={[
                  'flex items-start gap-3 p-4 rounded-xl border-2 text-left transition-all',
                  sourceType === s.id
                    ? 'border-indigo-500 bg-indigo-50'
                    : 'border-gray-200 hover:border-gray-300 bg-white',
                ].join(' ')}
              >
                <span className="text-2xl shrink-0">{s.icon}</span>
                <div>
                  <p className={`text-sm font-bold ${sourceType === s.id ? 'text-indigo-700' : 'text-gray-800'}`}>{s.label}</p>
                  <p className="text-xs text-gray-400 mt-0.5 leading-snug">{s.desc}</p>
                </div>
              </button>
            ))}
          </div>
        </section>

        {/* Step 2 — Input */}
        <section className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm space-y-4">
          <div>
            <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">Step 2</p>
            <h2 className="text-base font-bold text-gray-900 mt-0.5">
              Provide the {currentType.label}
            </h2>
          </div>

          {sourceType === 'youtube' && (
            <input
              type="url"
              value={url}
              onChange={e => setUrl(e.target.value)}
              placeholder="https://youtu.be/... or https://www.youtube.com/watch?v=..."
              className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 text-gray-800 placeholder-gray-300"
            />
          )}

          {(sourceType === 'pdf' || sourceType === 'docx') && (
            <div>
              <input
                ref={fileInputRef}
                type="file"
                accept={currentType.accept}
                onChange={e => setFile(e.target.files?.[0] ?? null)}
                className="hidden"
              />
              {file ? (
                <div className="flex items-center gap-3 p-4 bg-indigo-50 border border-indigo-200 rounded-xl">
                  <span className="text-2xl">{currentType.icon}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-indigo-700 truncate">{file.name}</p>
                    <p className="text-xs text-gray-400">{(file.size / 1024).toFixed(0)} KB</p>
                  </div>
                  <button
                    onClick={() => { setFile(null); setExtracted(null) }}
                    className="text-gray-400 hover:text-gray-600"
                  >
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full py-10 border-2 border-dashed border-gray-200 rounded-xl text-center hover:border-indigo-300 hover:bg-indigo-50/30 transition-all group"
                >
                  <p className="text-3xl mb-2">{currentType.icon}</p>
                  <p className="text-sm font-semibold text-gray-600 group-hover:text-indigo-600">
                    Click to select {currentType.label}
                  </p>
                  <p className="text-xs text-gray-400 mt-1">
                    {currentType.accept?.split(',').join(', ')} — max 4 MB
                  </p>
                </button>
              )}
            </div>
          )}

          {sourceType === 'text' && (
            <div className="space-y-3">
              <textarea
                value={pastedText}
                onChange={e => setPastedText(e.target.value)}
                placeholder="Paste any text here — teacher notes, copied paragraphs, transcripts, summaries..."
                rows={8}
                className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 text-gray-800 placeholder-gray-300 resize-none"
              />
              <p className="text-xs text-gray-400">
                Or upload a .txt file instead:
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="ml-1 text-indigo-500 hover:underline"
                >
                  choose file
                </button>
                {file && <span className="ml-1 text-indigo-600 font-medium">{file.name}</span>}
              </p>
              <input
                ref={fileInputRef}
                type="file"
                accept={currentType.accept}
                onChange={e => setFile(e.target.files?.[0] ?? null)}
                className="hidden"
              />
            </div>
          )}

          {extractError && (
            <div className="flex items-start gap-2 p-3 bg-red-50 border border-red-200 rounded-xl">
              <svg className="h-4 w-4 text-red-500 mt-0.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <p className="text-sm text-red-700">{extractError}</p>
            </div>
          )}

          <button
            onClick={handleExtract}
            disabled={!canExtract || extracting || !!extracted}
            className={[
              'w-full py-3 rounded-xl font-bold text-sm transition-all',
              !canExtract || !!extracted
                ? 'bg-gray-100 text-gray-300 cursor-not-allowed'
                : extracting
                ? 'bg-indigo-400 text-white cursor-wait'
                : 'bg-indigo-600 text-white hover:bg-indigo-700 active:scale-[0.99] shadow-sm',
            ].join(' ')}
          >
            {extracting ? (
              <span className="flex items-center justify-center gap-2">
                <span className="h-4 w-4 rounded-full border-2 border-white border-t-transparent animate-spin" />
                Extracting content...
              </span>
            ) : extracted ? (
              <span className="flex items-center justify-center gap-1.5 text-green-700">
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
                Extracted — {extracted.wordCount.toLocaleString()} words
              </span>
            ) : (
              `Extract content →`
            )}
          </button>
        </section>

        {/* Step 3 — Preview */}
        {extracted && (
          <section className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">Step 3</p>
                <h2 className="text-base font-bold text-gray-900 mt-0.5">Content preview</h2>
              </div>
              <span className="text-xs font-semibold text-indigo-600 bg-indigo-50 px-2.5 py-1 rounded-full">
                {extracted.wordCount.toLocaleString()} words
              </span>
            </div>
            <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 max-h-52 overflow-y-auto">
              <p className="text-xs text-gray-600 leading-relaxed whitespace-pre-wrap font-mono">
                {extracted.text.slice(0, 1500)}{extracted.text.length > 1500 ? `\n\n... (${(extracted.text.length - 1500).toLocaleString()} more characters)` : ''}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <svg className="h-4 w-4 text-green-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
              <p className="text-xs text-gray-500">
                Looks good? Fill in the metadata below and save.
                Not right? <button onClick={() => { setExtracted(null); setExtractError('') }} className="text-indigo-500 hover:underline">Re-extract</button>
              </p>
            </div>
          </section>
        )}

        {/* Step 4 — Metadata + save */}
        {extracted && (
          <section className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm space-y-5">
            <div>
              <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">Step 4</p>
              <h2 className="text-base font-bold text-gray-900 mt-0.5">Tag this source</h2>
              <p className="text-xs text-gray-400 mt-0.5">
                These tags tell the AI when to use this source — be specific.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-semibold text-gray-600 block mb-1.5">Grade</label>
                <select
                  value={grade}
                  onChange={e => setGrade(e.target.value)}
                  className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 text-gray-800"
                >
                  <option value="9">Class 9</option>
                  <option value="10">Class 10</option>
                  <option value="SEE Prep">SEE Prep</option>
                </select>
              </div>

              <div>
                <label className="text-xs font-semibold text-gray-600 block mb-1.5">Subject</label>
                <select
                  value={subjectId}
                  onChange={e => setSubjectId(e.target.value)}
                  className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 text-gray-800"
                >
                  {Object.entries(SUBJECT_NAMES).map(([id, name]) => (
                    <option key={id} value={id}>{name}</option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className="text-xs font-semibold text-gray-600 block mb-1.5">
                Topics covered <span className="text-gray-400 font-normal">(comma separated)</span>
              </label>
              <input
                type="text"
                value={topicInput}
                onChange={e => setTopicInput(e.target.value)}
                placeholder="e.g. Photosynthesis, Chlorophyll, Light reaction"
                className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 text-gray-800 placeholder-gray-300"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-semibold text-gray-600 block mb-1.5">Source title / label</label>
                <input
                  type="text"
                  value={title}
                  onChange={e => setTitle(e.target.value)}
                  placeholder="e.g. Gurakul Nepal – Class 9 Science"
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 text-gray-800 placeholder-gray-300"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-600 block mb-1.5">Year BS</label>
                <input
                  type="number"
                  value={yearBs}
                  onChange={e => setYearBs(e.target.value)}
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 text-gray-800"
                />
              </div>
            </div>

            {saveError && (
              <div className="flex items-start gap-2 p-3 bg-red-50 border border-red-200 rounded-xl">
                <svg className="h-4 w-4 text-red-500 mt-0.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <p className="text-sm text-red-700">{saveError}</p>
              </div>
            )}

            <button
              onClick={handleSave}
              disabled={saving}
              className={[
                'w-full py-4 rounded-xl font-black text-sm transition-all shadow-sm',
                saving
                  ? 'bg-indigo-400 text-white cursor-wait'
                  : 'bg-indigo-600 text-white hover:bg-indigo-700 active:scale-[0.99]',
              ].join(' ')}
            >
              {saving ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="h-4 w-4 rounded-full border-2 border-white border-t-transparent animate-spin" />
                  Saving to knowledge base...
                </span>
              ) : (
                'Save to knowledge base →'
              )}
            </button>
          </section>
        )}
      </main>
    </div>
  )
}

export default function SourcesPage() {
  return (
    <Suspense>
      <SourcesPageInner />
    </Suspense>
  )
}
