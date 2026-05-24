export async function POST(req: Request) {
  if (req.headers.get('x-admin-secret') !== process.env.ADMIN_SECRET) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const pipelineUrl = process.env.PIPELINE_SERVICE_URL
  if (!pipelineUrl) {
    return Response.json({ error: 'Pipeline service not configured' }, { status: 503 })
  }

  const body = await req.json()

  const res = await fetch(`${pipelineUrl}/ingest`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Pipeline-Secret': process.env.PIPELINE_SECRET_KEY ?? '',
    },
    body: JSON.stringify(body),
  })

  const data = res.headers.get('content-type')?.includes('application/json')
    ? await res.json()
    : { message: await res.text() }

  return Response.json(data, { status: res.status })
}
