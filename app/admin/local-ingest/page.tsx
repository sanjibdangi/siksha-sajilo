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
const FILE_TYPES = [
  { id: 'notes', label: 'Notes' },
  { id: 'past_paper', label: 'Past Paper' },
  { id: 'model_question', label: 'Model Question' },
  { id: 'textbook', label: 'Textbook' },
  { id: 'article', label: 'Article' },
] as const

const LOCAL_TYPES = new Set([
  'notes', 'past_paper', 'model_question', 'textbook', 'article',
  'youtube_transcript', 'local_pdf', 'local_docx', 'local_pptx',
  'local_image', 'local_spreadsheet',
])

function detectFileType(input: string): string {
  const lower = input.toLowerCase()
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

const TABS = ['files', 'youtube', 'setup', 'history'] as const
type Tab = typeof TABS[number]

export default function LocalIngestPage() {
  const [secret] = useState(() =>
    typeof window !== 'undefined' ? sessionStorage.getItem(ADMIN_SECRET_KEY) ?? '' : ''
  )

  const [tab, setTab] = useState<Tab>('youtube')

  // Shared fields
  const [grade, setGrade] = useState('10')
  const [subject, setSubject] = useState('mathematics')
  const [title, setTitle] = useState('')
  const [year, setYear] = useState('')

  // Files & Web tab
  const [fileInput, setFileInput] = useState('')
  const [fileType, setFileType] = useState('notes')
  const [fileDryRun, setFileDryRun] = useState(false)
  const [fileCopied, setFileCopied] = useState(false)

  // YouTube Audio tab
  const [ytUrl, setYtUrl] = useState('')
  const [ytLanguage, setYtLanguage] = useState('')
  const [ytDryRun, setYtDryRun] = useState(false)
  const [ytKeepAudio, setYtKeepAudio] = useState(false)
  const [ytCopied, setYtCopied] = useState(false)

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
        .limit(40)
      setHistory(data ?? [])
    } catch { /* non-fatal */ }
    finally { setHistLoading(false) }
  }, [])

  useEffect(() => { loadHistory() }, [loadHistory])

  // Auto-detect file type when input changes
  useEffect(() => {
    if (!fileInput) return
    const detected = detectFileType(fileInput)
    if (detected !== 'article') setFileType(detected)
  }, [fileInput])

  function buildFileCommand(): string {
    const parts = [
      'python scripts/markitdown_ingest.py',
      `  --input "${fileInput || '<URL or /path/to/file>'}"`,
      `  --grade "${grade}"`,
      `  --subject ${subject}`,
      `  --type ${fileType}`,
      `  --title "${title || '<Title here>'}"`,
    ]
    if (year) parts.push(`  --year ${year}`)
    if (fileDryRun) parts.push('  --dry-run')
    return parts.join(' \\\n')
  }

  function buildYtCommand(): string {
    const parts = [
      'python scripts/youtube_ingest.py',
      `  --input "${ytUrl || '<YouTube URL>'}"`,
      `  --grade "${grade}"`,
      `  --subject ${subject}`,
      `  --title "${title || '<Title here>'}"`,
    ]
    if (year) parts.push(`  --year ${year}`)
    if (ytLanguage) parts.push(`  --language ${ytLanguage}`)
    if (ytDryRun) parts.push('  --dry-run')
    if (ytKeepAudio) parts.push('  --keep-audio')
    return parts.join(' \\\n')
  }

  async function copyFile() {
    try { await navigator.clipboard.writeText(buildFileCommand()); setFileCopied(true); setTimeout(() => setFileCopied(false), 2000) } catch { /* */ }
  }
  async function copyYt() {
    try { await navigator.clipboard.writeText(buildYtCommand()); setYtCopied(true); setTimeout(() => setYtCopied(false), 2000) } catch { /* */ }
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

  const tabLabel: Record<Tab, string> = {
    files: 'Files & Web',
    youtube: 'YouTube Audio',
    setup: 'Setup',
    history: 'History',
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="max-w-3xl mx-auto flex items-center gap-3">
          <Link href="/admin" className="text-sm text-gray-400 hover:text-gray-600 transition-colors">
            &larr; Admin
          </Link>
          <span className="text-gray-300">|</span>
          <span className="font-bold text-green-700">Local Ingest</span>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-8 space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-xl font-bold text-gray-900">Local Ingest Tools</h1>
          <p className="text-sm text-gray-500 mt-1">
            Convert external content into RAG knowledge. Run commands locally — results upload to Supabase automatically.
          </p>
        </div>

        {/* Capability chips */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {[
            { icon: '▶️', label: 'YouTube Audio', note: 'Even no-transcript videos', highlight: true },
            { icon: '📄', label: 'PDF / DOCX', note: 'Any local file — free' },
            { icon: '📊', label: 'PPTX / XLSX', note: 'Slides & spreadsheets' },
            { icon: '🌐', label: 'Web pages', note: 'Any URL — free' },
          ].map(f => (
            <div
              key={f.label}
              className={`border rounded-lg p-3 text-center ${f.highlight ? 'bg-red-50 border-red-200' : 'bg-white border-gray-200'}`}
            >
              <div className="text-xl">{f.icon}</div>
              <div className={`text-xs font-semibold mt-1 ${f.highlight ? 'text-red-800' : 'text-gray-800'}`}>{f.label}</div>
              <div className={`text-xs mt-0.5 ${f.highlight ? 'text-red-600' : 'text-gray-400'}`}>{f.note}</div>
            </div>
          ))}
        </div>

        {/* Tabs */}
        <div className="flex border-b border-gray-200 overflow-x-auto">
          {TABS.map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-4 py-2 text-sm font-medium whitespace-nowrap transition-colors border-b-2 -mb-px ${
                tab === t
                  ? t === 'youtube' ? 'border-red-500 text-red-700' : 'border-green-600 text-green-700'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              {tabLabel[t]}
              {t === 'youtube' && (
                <span className="ml-1.5 text-xs bg-red-100 text-red-700 px-1.5 py-0.5 rounded-full">new</span>
              )}
            </button>
          ))}
        </div>

        {/* ── Shared grade/subject/title/year fields ── */}
        {(tab === 'files' || tab === 'youtube') && (
          <Card padding="md" className="space-y-3">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Content metadata</p>
            <div>
              <label className="text-xs font-medium text-gray-600 block mb-1">
                Title <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={title}
                onChange={e => setTitle(e.target.value)}
                placeholder={tab === 'youtube' ? 'e.g. SEE Maths Model Questions Solution 2082' : 'e.g. Class 10 Science — Electricity Notes'}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
              />
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="text-xs font-medium text-gray-600 block mb-1">Grade</label>
                <select value={grade} onChange={e => setGrade(e.target.value)}
                  className="w-full px-2 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500">
                  {GRADES.map(g => <option key={g} value={g}>{g}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs font-medium text-gray-600 block mb-1">Subject</label>
                <select value={subject} onChange={e => setSubject(e.target.value)}
                  className="w-full px-2 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500">
                  {SUBJECTS.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs font-medium text-gray-600 block mb-1">BS Year (opt.)</label>
                <input type="number" value={year} onChange={e => setYear(e.target.value)}
                  placeholder="2082"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500" />
              </div>
            </div>
          </Card>
        )}

        {/* ── Tab: Files & Web ── */}
        {tab === 'files' && (
          <div className="space-y-4">
            <Card padding="md" className="space-y-4">
              <h2 className="text-sm font-semibold text-gray-700">File / URL input</h2>
              <div>
                <label className="text-xs font-medium text-gray-600 block mb-1">
                  URL or absolute file path <span className="text-red-500">*</span>
                </label>
                <input type="text" value={fileInput} onChange={e => setFileInput(e.target.value)}
                  placeholder="/Users/you/see-2079-math.pdf  or  https://example.com/notes"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500" />
                <p className="text-xs text-gray-400 mt-0.5">PDF, DOCX, PPTX, XLSX, image, or any web URL. Free — no AI key used.</p>
              </div>
              <div className="flex items-end gap-4">
                <div className="w-40">
                  <label className="text-xs font-medium text-gray-600 block mb-1">Content type</label>
                  <select value={fileType} onChange={e => setFileType(e.target.value)}
                    className="w-full px-2 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500">
                    {FILE_TYPES.map(t => <option key={t.id} value={t.id}>{t.label}</option>)}
                  </select>
                </div>
                <label className="flex items-center gap-2 cursor-pointer pb-2">
                  <input type="checkbox" checked={fileDryRun} onChange={e => setFileDryRun(e.target.checked)} className="rounded" />
                  <span className="text-sm text-gray-600">Dry run</span>
                </label>
              </div>
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-medium text-gray-600">Generated command</label>
                  <button onClick={copyFile} className="text-xs text-green-600 hover:text-green-800 font-medium">
                    {fileCopied ? 'Copied!' : 'Copy'}
                  </button>
                </div>
                <pre className="bg-gray-900 text-green-400 text-xs rounded-lg p-4 overflow-x-auto font-mono whitespace-pre">
                  {buildFileCommand()}
                </pre>
              </div>
            </Card>
          </div>
        )}

        {/* ── Tab: YouTube Audio ── */}
        {tab === 'youtube' && (
          <div className="space-y-4">
            {/* How it works */}
            <div className="bg-red-50 border border-red-200 rounded-xl p-4 space-y-2">
              <p className="text-sm font-semibold text-red-800">How this works</p>
              <div className="flex items-start gap-3 text-xs text-red-700">
                {['yt-dlp downloads the audio as MP3 (bypasses transcript restrictions)',
                  'OpenAI Whisper API transcribes speech — handles Nepali + English mix',
                  'Claude Haiku formats the raw transcript: fixes math notation, adds structure, removes fillers',
                  'Voyage embeds the cleaned text and saves to Supabase knowledge_sources'].map((s, i) => (
                  <div key={i} className="flex items-start gap-2 flex-1 min-w-0">
                    <span className="shrink-0 w-5 h-5 rounded-full bg-red-200 text-red-800 font-bold text-xs flex items-center justify-center">{i + 1}</span>
                    <span>{s}</span>
                  </div>
                ))}
              </div>
              <p className="text-xs text-red-600 mt-1">
                Cost: ~$0.006/min Whisper + ~$0.01 Haiku cleanup = <strong>~$0.07 per 10-min video</strong>
              </p>
            </div>

            <Card padding="md" className="space-y-4">
              <h2 className="text-sm font-semibold text-gray-700">YouTube URL</h2>
              <div>
                <label className="text-xs font-medium text-gray-600 block mb-1">
                  YouTube URL <span className="text-red-500">*</span>
                </label>
                <input type="text" value={ytUrl} onChange={e => setYtUrl(e.target.value)}
                  placeholder="https://youtu.be/... or https://www.youtube.com/watch?v=..."
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-400" />
              </div>

              <div className="flex items-center gap-4 flex-wrap">
                <div className="w-44">
                  <label className="text-xs font-medium text-gray-600 block mb-1">
                    Language hint <span className="text-gray-400">(optional)</span>
                  </label>
                  <select value={ytLanguage} onChange={e => setYtLanguage(e.target.value)}
                    className="w-full px-2 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-400">
                    <option value="">Auto-detect (recommended)</option>
                    <option value="ne">ne — Nepali</option>
                    <option value="en">en — English</option>
                    <option value="hi">hi — Hindi</option>
                  </select>
                  <p className="text-xs text-gray-400 mt-0.5">Auto-detect handles Nepali+English mix best</p>
                </div>
                <div className="flex flex-col gap-2 pb-1">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" checked={ytDryRun} onChange={e => setYtDryRun(e.target.checked)} className="rounded" />
                    <span className="text-sm text-gray-600">Dry run (preview, no DB insert)</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" checked={ytKeepAudio} onChange={e => setYtKeepAudio(e.target.checked)} className="rounded" />
                    <span className="text-sm text-gray-600">Keep downloaded MP3 file</span>
                  </label>
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-medium text-gray-600">Generated command</label>
                  <button onClick={copyYt} className="text-xs text-red-600 hover:text-red-800 font-medium">
                    {ytCopied ? 'Copied!' : 'Copy'}
                  </button>
                </div>
                <pre className="bg-gray-900 text-red-400 text-xs rounded-lg p-4 overflow-x-auto font-mono whitespace-pre">
                  {buildYtCommand()}
                </pre>
              </div>

              <div className="bg-gray-50 border border-gray-200 rounded-lg p-3 text-xs text-gray-700 space-y-1">
                <p className="font-medium text-gray-800">How to run:</p>
                <p>1. Ensure setup is done — see <button onClick={() => setTab('setup')} className="text-green-600 underline">Setup tab</button></p>
                <p>2. Open terminal in project root, activate your venv</p>
                <p>3. Paste and run the command — it will print progress live</p>
                <p>4. Come back and refresh <button onClick={() => setTab('history')} className="text-green-600 underline">History</button> to confirm ingestion</p>
              </div>
            </Card>

            {/* Required env note */}
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-xs text-amber-800 space-y-1">
              <p className="font-semibold">Required in .env.local for YouTube Audio:</p>
              <p><code className="bg-amber-100 px-1 rounded">OPENAI_API_KEY</code> — Whisper transcription API (~$0.006/min)</p>
              <p><code className="bg-amber-100 px-1 rounded">ANTHROPIC_API_KEY</code> — Claude Haiku cleanup (you already have this)</p>
              <p><code className="bg-amber-100 px-1 rounded">ffmpeg</code> — system install: <code className="bg-amber-100 px-1 rounded">winget install ffmpeg</code></p>
            </div>
          </div>
        )}

        {/* ── Tab: Setup ── */}
        {tab === 'setup' && (
          <div className="space-y-4">
            <Card padding="md" className="space-y-4">
              <h2 className="text-sm font-semibold text-gray-700">One-time setup</h2>
              <div className="space-y-4">
                {[
                  {
                    step: '1',
                    title: 'Ensure Python 3.10+ is installed',
                    code: 'python --version',
                    note: 'Must be 3.10 or higher.',
                  },
                  {
                    step: '2',
                    title: 'Create a virtual environment',
                    code: 'python -m venv .venv\nsource .venv/bin/activate  # Mac/Linux\n.venv\\Scripts\\activate    # Windows',
                    note: 'Keeps script dependencies isolated.',
                  },
                  {
                    step: '3',
                    title: 'Install Python dependencies',
                    code: 'pip install -r scripts/requirements.txt',
                    note: 'Installs MarkItDown, yt-dlp, openai, anthropic, supabase-py, voyageai, pydub.',
                  },
                  {
                    step: '4',
                    title: 'Install ffmpeg (required for YouTube Audio)',
                    code: 'winget install ffmpeg          # Windows\nbrew install ffmpeg            # Mac\nsudo apt install ffmpeg        # Ubuntu/Debian',
                    note: 'yt-dlp needs ffmpeg to convert audio to MP3.',
                  },
                  {
                    step: '5',
                    title: 'Add OPENAI_API_KEY to .env.local',
                    code: 'OPENAI_API_KEY=sk-...',
                    note: 'Get one at platform.openai.com — fund with $5, a 10-min video costs ~$0.07.',
                  },
                  {
                    step: '6',
                    title: 'Test with a dry run',
                    code: 'python scripts/youtube_ingest.py \\\n  --input "https://youtu.be/<any-video>" \\\n  --grade 10 --subject mathematics \\\n  --title "Test" --dry-run',
                    note: 'Downloads audio, transcribes, cleans — prints output without inserting to DB.',
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
              <h2 className="text-sm font-semibold text-gray-700">All required env vars</h2>
              <div className="space-y-2">
                {[
                  { key: 'NEXT_PUBLIC_SUPABASE_URL', req: true, note: 'Supabase project URL' },
                  { key: 'SUPABASE_SERVICE_ROLE_KEY', req: true, note: 'For writing to knowledge_sources' },
                  { key: 'OPENAI_API_KEY', req: true, note: 'For Whisper API (YouTube Audio only)' },
                  { key: 'ANTHROPIC_API_KEY', req: false, note: 'For Haiku cleanup (recommended — you already have this)' },
                  { key: 'VOYAGE_API_KEY', req: false, note: 'For embedding — without it RAG won\'t rank this item' },
                ].map(v => (
                  <div key={v.key} className="flex items-start gap-2 text-xs flex-wrap">
                    <code className="bg-gray-100 px-1.5 py-0.5 rounded font-mono text-gray-800 shrink-0">{v.key}</code>
                    <Badge variant={v.req ? 'error' : 'info'} className="shrink-0">{v.req ? 'required' : 'recommended'}</Badge>
                    <span className="text-gray-500">{v.note}</span>
                  </div>
                ))}
              </div>
            </Card>
          </div>
        )}

        {/* ── Tab: History ── */}
        {tab === 'history' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <p className="text-sm text-gray-600">All locally ingested items ({history.length})</p>
              <button onClick={loadHistory} disabled={histLoading}
                className="text-xs text-green-600 hover:text-green-800 disabled:opacity-40 transition-colors">
                {histLoading ? 'Loading...' : 'Refresh'}
              </button>
            </div>

            {histLoading ? (
              <div className="space-y-2">
                {[1, 2, 3].map(i => <div key={i} className="h-16 bg-white rounded-lg border border-gray-200 animate-pulse" />)}
              </div>
            ) : history.length === 0 ? (
              <Card padding="md" className="text-center py-10">
                <p className="text-4xl mb-3">📭</p>
                <p className="text-sm font-medium text-gray-700">Nothing ingested yet</p>
                <p className="text-xs text-gray-400 mt-1">Use the YouTube Audio or Files &amp; Web tab to run your first ingest.</p>
              </Card>
            ) : (
              <div className="space-y-2">
                {history.map(item => (
                  <Card key={item.id} padding="sm" className="flex items-start gap-3">
                    <div className="text-lg shrink-0 mt-0.5">
                      {item.source_type === 'youtube_transcript' ? '▶️'
                        : item.source_type === 'local_pdf' ? '📄'
                        : item.source_type === 'local_docx' ? '📝'
                        : item.source_type === 'past_paper' ? '📋'
                        : item.source_type === 'notes' ? '📚' : '🌐'}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">{item.title}</p>
                      <p className="text-xs text-gray-400 truncate mt-0.5">{item.source_url}</p>
                      <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                        <Badge variant="info">Grade {item.grade}</Badge>
                        <Badge variant="info" className="capitalize">{item.subject_id}</Badge>
                        <span className="text-xs text-gray-400">{item.word_count?.toLocaleString()} words</span>
                        <span className="text-xs text-gray-400">
                          {new Date(item.created_at).toLocaleDateString('en-NP', { day: 'numeric', month: 'short', year: 'numeric' })}
                        </span>
                      </div>
                    </div>
                    <Badge variant={item.status === 'active' ? 'success' : 'warning'} className="shrink-0 mt-0.5">
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
