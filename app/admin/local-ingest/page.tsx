'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { createClient } from '@/lib/supabase'

const ADMIN_SECRET_KEY = 'siksha_admin_secret'

const GRADES = ['9', '10', 'SEE Prep'] as const
const SUBJECTS = [
  { id: 'mathematics', label: 'Mathematics' },
  { id: 'science', label: 'Science' },
  { id: 'english', label: 'English' },
  { id: 'nepali', label: 'Nepali' },
  { id: 'social', label: 'Social Studies' },
  { id: 'optmath', label: 'Optional Mathematics' },
] as const
const TYPES = [
  { id: 'notes', label: 'Notes' },
  { id: 'past_paper', label: 'Past Paper' },
  { id: 'model_question', label: 'Model Question' },
  { id: 'textbook', label: 'Textbook' },
  { id: 'article', label: 'Article' },
  { id: 'youtube_transcript', label: 'YouTube Transcript' },
] as const

const LOCAL_TYPES = new Set(['notes', 'past_paper', 'model_question', 'textbook', 'article',
  'youtube_transcript', 'local_pdf', 'local_docx', 'local_pptx', 'local_image', 'local_spreadsheet'])

function detectInputType(input: string): string {
  const lower = input.toLowerCase()
  if (lower.includes('youtube.com') || lower.includes('youtu.be')) return 'youtube_transcript'
  if (lower.endsWith('.pdf')) return 'local_pdf'
  if (lower.endsWith('.docx') || lower.endsWith('.doc')) return 'local_docx'
  if (lower.endsWith('.pptx') || lower.endsWith('.ppt')) return 'local_pptx'
  if (lower.endsWith('.xlsx') || lower.endsWith('.xls') || lower.endsWith('.csv')) return 'local_spreadsheet'
  if (lower.match(/\.(png|jpg|jpeg|webp|gif)$/)) return 'local_image'
  return 'article'
}

interface RecentItem {
  id: string
  title: string
  source_type: string
  grade: string
  subject_id: string
  word_count: number
  status: string
  created_at: string
  source_url?: string
}

const TABS = ['generator', 'setup', 'history'] as const
type Tab = typeof TABS[number]

export default function LocalIngestPage() {
  const [secret] = useState(() =>
    typeof window !== 'undefined' ? sessionStorage.getItem(ADMIN_SECRET_KEY) ?? '' : ''
  )

  const [tab, setTab] = useState<Tab>('generator')

  // Form fields
  const [input, setInput] = useState('')
  const [grade, setGrade] = useState<string>('10')
  const [subject, setSubject] = useState<string>('mathematics')
  const [type, setType] = useState<string>('notes')
  const [title, setTitle] = useState('')
  const [year, setYear] = useState('')
  const [dryRun, setDryRun] = useState(false)
  const [copied, setCopied] = useState(false)

  // History
  const [history, setHistory] = useState<RecentItem[]>([])
  const [histLoading, setHistLoading] = useState(false)

  const loadHistory = useCallback(async () => {
    setHistLoading(true)
    try {
      const supabase = createClient()
      const { data } = await supabase
        .from('knowledge_sources')
        .select('id, title, source_type, grade, subject_id, word_count, status, created_at, source_url')
        .in('source_type', Array.from(LOCAL_TYPES))
        .order('created_at', { ascending: false })
        .limit(30)
      setHistory(data ?? [])
    } catch { /* non-fatal */ }
    finally { setHistLoading(false) }
  }, [])

  useEffect(() => { loadHistory() }, [loadHistory])

  // Auto-detect type from input
  useEffect(() => {
    if (!input) return
    const detected = detectInputType(input)
    if (detected !== 'article') setType(detected)
    // Auto-suggest title from YouTube URL
    if ((input.includes('youtube.com') || input.includes('youtu.be')) && !title) {
      setTitle('YouTube: ')
    }
  }, [input, title])

  function buildCommand(): string {
    const scriptPath = 'scripts/markitdown_ingest.py'
    const parts = [
      `python ${scriptPath}`,
      `  --input "${input || '<URL or /path/to/file>'}"`,
      `  --grade "${grade}"`,
      `  --subject ${subject}`,
      `  --type ${type}`,
      `  --title "${title || '<Title here>'}"`,
    ]
    if (year) parts.push(`  --year ${year}`)
    if (dryRun) parts.push('  --dry-run')
    return parts.join(' \\\n')
  }

  async function copyCommand() {
    try {
      await navigator.clipboard.writeText(buildCommand())
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch { /* fallback: select text */ }
  }

  if (!secret) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Card className="p-6 text-center space-y-3">
          <p className="text-sm text-gray-600">Not authenticated.</p>
          <Link href="/admin"><Button size="sm">Back to admin</Button></Link>
        </Card>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="max-w-3xl mx-auto flex items-center gap-3">
          <Link href="/admin" className="text-sm text-gray-400 hover:text-gray-600 transition-colors">← Admin</Link>
          <span className="text-gray-300">|</span>
          <span className="font-bold text-green-700">MarkItDown — Local Ingest</span>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-8 space-y-6">
        {/* Header */}
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-xl font-bold text-gray-900">Local MarkItDown Ingest</h1>
            <p className="text-sm text-gray-500 mt-1">
              Convert files and URLs to knowledge — free, no AI key needed. Run the generated command on your machine.
            </p>
          </div>
          <a
            href="https://github.com/microsoft/markitdown"
            target="_blank"
            rel="noopener noreferrer"
            className="shrink-0 text-xs text-gray-400 hover:text-gray-600 underline"
          >
            GitHub
          </a>
        </div>

        {/* What it supports */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {[
            { icon: '▶️', label: 'YouTube', note: 'If captions on' },
            { icon: '📄', label: 'PDF / DOCX', note: 'Any local file' },
            { icon: '📊', label: 'PPTX / XLSX', note: 'Presentations, sheets' },
            { icon: '🌐', label: 'Web URLs', note: 'HTML pages' },
          ].map(f => (
            <div key={f.label} className="bg-white border border-gray-200 rounded-lg p-3 text-center">
              <div className="text-xl">{f.icon}</div>
              <div className="text-xs font-semibold text-gray-800 mt-1">{f.label}</div>
              <div className="text-xs text-gray-400">{f.note}</div>
            </div>
          ))}
        </div>

        {/* Tabs */}
        <div className="flex border-b border-gray-200">
          {TABS.map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-4 py-2 text-sm font-medium capitalize transition-colors border-b-2 -mb-px ${
                tab === t
                  ? 'border-green-600 text-green-700'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              {t === 'generator' ? 'Command Generator' : t === 'setup' ? 'Setup' : 'History'}
            </button>
          ))}
        </div>

        {/* ── Tab: Command Generator ── */}
        {tab === 'generator' && (
          <div className="space-y-5">
            <Card padding="md" className="space-y-4">
              <h2 className="text-sm font-semibold text-gray-700">Build your ingest command</h2>

              <div className="space-y-3">
                {/* Input */}
                <div>
                  <label className="text-xs font-medium text-gray-600 block mb-1">
                    URL or file path <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={input}
                    onChange={e => setInput(e.target.value)}
                    placeholder="https://youtube.com/watch?v=... or /Users/you/paper.pdf"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                  />
                  <p className="text-xs text-gray-400 mt-0.5">
                    YouTube URL, web page URL, or absolute local file path (PDF, DOCX, PPTX, XLSX, image)
                  </p>
                </div>

                {/* Title */}
                <div>
                  <label className="text-xs font-medium text-gray-600 block mb-1">
                    Title <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={title}
                    onChange={e => setTitle(e.target.value)}
                    placeholder="e.g. Class 10 Science — Electricity Notes"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                  />
                </div>

                {/* Grade + Subject + Type row */}
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="text-xs font-medium text-gray-600 block mb-1">Grade</label>
                    <select
                      value={grade}
                      onChange={e => setGrade(e.target.value)}
                      className="w-full px-2 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                    >
                      {GRADES.map(g => <option key={g} value={g}>{g}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="text-xs font-medium text-gray-600 block mb-1">Subject</label>
                    <select
                      value={subject}
                      onChange={e => setSubject(e.target.value)}
                      className="w-full px-2 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                    >
                      {SUBJECTS.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="text-xs font-medium text-gray-600 block mb-1">Type</label>
                    <select
                      value={type}
                      onChange={e => setType(e.target.value)}
                      className="w-full px-2 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                    >
                      {TYPES.map(t => <option key={t.id} value={t.id}>{t.label}</option>)}
                    </select>
                  </div>
                </div>

                {/* Year + Dry run row */}
                <div className="flex items-end gap-4">
                  <div className="w-32">
                    <label className="text-xs font-medium text-gray-600 block mb-1">BS Year (optional)</label>
                    <input
                      type="number"
                      value={year}
                      onChange={e => setYear(e.target.value)}
                      placeholder="2079"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                    />
                  </div>
                  <label className="flex items-center gap-2 cursor-pointer pb-2">
                    <input
                      type="checkbox"
                      checked={dryRun}
                      onChange={e => setDryRun(e.target.checked)}
                      className="rounded"
                    />
                    <span className="text-sm text-gray-600">Dry run (preview only, no DB insert)</span>
                  </label>
                </div>
              </div>

              {/* Generated command */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-medium text-gray-600">Generated command</label>
                  <button
                    onClick={copyCommand}
                    className="text-xs text-green-600 hover:text-green-800 font-medium transition-colors"
                  >
                    {copied ? 'Copied!' : 'Copy'}
                  </button>
                </div>
                <pre className="bg-gray-900 text-green-400 text-xs rounded-lg p-4 overflow-x-auto font-mono whitespace-pre">
                  {buildCommand()}
                </pre>
              </div>

              <div className="bg-green-50 border border-green-200 rounded-lg p-3 text-xs text-green-800 space-y-1">
                <p className="font-medium">How to run:</p>
                <p>1. Open a terminal in the <code className="bg-green-100 px-1 rounded">siksha-sajilo/</code> project root.</p>
                <p>2. Make sure Python setup is done (see Setup tab).</p>
                <p>3. Paste and run the command above.</p>
                <p>4. When done, come back here and click Refresh in History tab.</p>
              </div>
            </Card>

            {/* YouTube note */}
            {(input.includes('youtube') || type === 'youtube_transcript') && (
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-xs text-amber-800">
                <p className="font-medium mb-1">YouTube note</p>
                <p>MarkItDown uses <code className="bg-amber-100 px-1 rounded">youtube-transcript-api</code> — this works only when the channel has captions/transcripts enabled. If the video has disabled transcripts, the conversion will fail (same limitation as before). For those videos, use the AI Knowledge Generator instead.</p>
              </div>
            )}
          </div>
        )}

        {/* ── Tab: Setup ── */}
        {tab === 'setup' && (
          <div className="space-y-4">
            <Card padding="md" className="space-y-4">
              <h2 className="text-sm font-semibold text-gray-700">One-time setup</h2>
              <p className="text-sm text-gray-600">Run these steps once in the project root. After that, just use the Command Generator tab.</p>

              <div className="space-y-3">
                {[
                  {
                    step: '1',
                    title: 'Ensure Python 3.10+ is installed',
                    code: 'python --version',
                    note: 'Must be 3.10 or higher.',
                  },
                  {
                    step: '2',
                    title: 'Create a virtual environment (recommended)',
                    code: 'python -m venv .venv\nsource .venv/bin/activate  # Mac/Linux\n.venv\\Scripts\\activate    # Windows',
                    note: 'Keeps dependencies isolated from your global Python.',
                  },
                  {
                    step: '3',
                    title: 'Install all dependencies',
                    code: 'pip install -r scripts/requirements.txt',
                    note: 'Installs MarkItDown (all formats), supabase-py, voyageai, python-dotenv. Takes ~1 min.',
                  },
                  {
                    step: '4',
                    title: 'Verify the script works',
                    code: 'python scripts/markitdown_ingest.py --help',
                    note: 'Should print the usage guide with no errors.',
                  },
                  {
                    step: '5',
                    title: 'Test with a dry run',
                    code: 'python scripts/markitdown_ingest.py \\\n  --input "https://en.wikipedia.org/wiki/Nepal" \\\n  --grade 10 --subject social \\\n  --type article --title "Test" \\\n  --dry-run',
                    note: 'Prints extracted markdown without inserting into DB.',
                  },
                ].map(s => (
                  <div key={s.step} className="flex gap-3">
                    <span className="shrink-0 w-6 h-6 rounded-full bg-green-100 text-green-700 text-xs font-bold flex items-center justify-center">{s.step}</span>
                    <div className="flex-1 space-y-1.5">
                      <p className="text-sm font-medium text-gray-800">{s.title}</p>
                      <pre className="bg-gray-900 text-green-400 text-xs rounded p-3 overflow-x-auto font-mono">{s.code}</pre>
                      <p className="text-xs text-gray-500">{s.note}</p>
                    </div>
                  </div>
                ))}
              </div>
            </Card>

            <Card padding="md" className="space-y-3">
              <h2 className="text-sm font-semibold text-gray-700">Required env vars</h2>
              <p className="text-xs text-gray-500">The script reads from <code className="bg-gray-100 px-1 rounded">.env.local</code> automatically.</p>
              <div className="space-y-2">
                {[
                  { key: 'NEXT_PUBLIC_SUPABASE_URL', required: true, note: 'Your Supabase project URL' },
                  { key: 'SUPABASE_SERVICE_ROLE_KEY', required: true, note: 'Service role key — for writing to knowledge_sources' },
                  { key: 'VOYAGE_API_KEY', required: false, note: 'For embedding generation. Without it, items are stored but RAG similarity search won\'t rank them.' },
                ].map(v => (
                  <div key={v.key} className="flex items-start gap-2 text-xs">
                    <code className="bg-gray-100 px-1.5 py-0.5 rounded font-mono text-gray-800 shrink-0">{v.key}</code>
                    <Badge variant={v.required ? 'error' : 'info'} className="shrink-0">{v.required ? 'required' : 'recommended'}</Badge>
                    <span className="text-gray-500">{v.note}</span>
                  </div>
                ))}
              </div>
            </Card>

            <Card padding="md" className="space-y-3 bg-blue-50 border-blue-200">
              <h2 className="text-sm font-semibold text-blue-800">What happens under the hood</h2>
              <ol className="text-xs text-blue-700 space-y-1 list-decimal list-inside">
                <li>MarkItDown converts the URL/file to clean markdown text (free, no AI key)</li>
                <li>Voyage AI generates a 1024-dim embedding for RAG similarity search</li>
                <li>The content is upserted into <code className="bg-blue-100 px-1 rounded">knowledge_sources</code> in Supabase</li>
                <li>The next student query that matches this content will pull it via RAG</li>
              </ol>
            </Card>
          </div>
        )}

        {/* ── Tab: History ── */}
        {tab === 'history' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <p className="text-sm text-gray-600">Items ingested via MarkItDown or local script</p>
              <button
                onClick={loadHistory}
                disabled={histLoading}
                className="text-xs text-green-600 hover:text-green-800 disabled:opacity-40 transition-colors"
              >
                {histLoading ? 'Loading…' : 'Refresh'}
              </button>
            </div>

            {histLoading ? (
              <div className="space-y-2">
                {[1, 2, 3].map(i => (
                  <div key={i} className="h-16 bg-white rounded-lg border border-gray-200 animate-pulse" />
                ))}
              </div>
            ) : history.length === 0 ? (
              <Card padding="md" className="text-center py-8">
                <p className="text-4xl mb-3">📭</p>
                <p className="text-sm font-medium text-gray-700">No locally ingested items yet</p>
                <p className="text-xs text-gray-400 mt-1">Use the Command Generator tab to run your first ingest.</p>
              </Card>
            ) : (
              <div className="space-y-2">
                {history.map(item => (
                  <Card key={item.id} padding="sm" className="flex items-start gap-3">
                    <div className="shrink-0 mt-0.5">
                      {item.source_type === 'youtube_transcript' ? '▶️' :
                       item.source_type === 'local_pdf' ? '📄' :
                       item.source_type === 'local_docx' ? '📝' :
                       item.source_type === 'past_paper' ? '📋' :
                       item.source_type === 'notes' ? '📚' : '🌐'}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">{item.title}</p>
                      <p className="text-xs text-gray-500 truncate mt-0.5">{item.source_url}</p>
                      <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                        <Badge variant="info">Grade {item.grade}</Badge>
                        <Badge variant="info" className="capitalize">{item.subject_id}</Badge>
                        <span className="text-xs text-gray-400">{item.word_count?.toLocaleString()} words</span>
                        <span className="text-xs text-gray-400">
                          {new Date(item.created_at).toLocaleDateString('en-NP', { day: 'numeric', month: 'short', year: 'numeric' })}
                        </span>
                      </div>
                    </div>
                    <Badge variant={item.status === 'active' ? 'success' : 'warning'} className="shrink-0">
                      {item.status}
                    </Badge>
                  </Card>
                ))}
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  )
}
