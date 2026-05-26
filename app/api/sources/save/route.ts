import { NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase'

export async function POST(req: Request) {
  if (req.headers.get('x-admin-secret') !== process.env.ADMIN_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { sourceType, title, sourceUrl, fileName, grade, subjectId, topicTags, yearBs, rawContent, wordCount } =
    await req.json()

  if (!sourceType || !grade || !subjectId || !rawContent) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
  }

  const supabase = createServerClient()

  const { data, error } = await supabase
    .from('knowledge_sources')
    .insert({
      source_type: sourceType,
      title: title || null,
      source_url: sourceUrl || null,
      file_name: fileName || null,
      grade,
      subject_id: subjectId,
      topic_tags: topicTags?.length ? topicTags : null,
      year_bs: yearBs || 2082,
      raw_content: rawContent,
      word_count: wordCount || null,
      status: 'active',
    })
    .select('id')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ ok: true, id: data.id })
}

export async function GET(req: Request) {
  if (req.headers.get('x-admin-secret') !== process.env.ADMIN_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = createServerClient()
  const { data, error } = await supabase
    .from('knowledge_sources')
    .select('id, source_type, title, file_name, source_url, grade, subject_id, topic_tags, word_count, status, created_at')
    .order('created_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ sources: data ?? [] })
}
