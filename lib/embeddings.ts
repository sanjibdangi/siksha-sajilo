import { VoyageAIClient } from 'voyageai'

const voyage = new VoyageAIClient({ apiKey: process.env.VOYAGE_API_KEY })

export async function embed(text: string): Promise<number[]> {
  const response = await voyage.embed({
    input: [text],
    model: 'voyage-multilingual-2',
  })
  const embedding = response.data?.[0]?.embedding
  if (!embedding) throw new Error('No embedding returned from Voyage AI')
  return embedding
}
