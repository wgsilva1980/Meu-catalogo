import { NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@/lib/supabase/server'
import { resolveActiveCompany } from '@/lib/company'

export const runtime = 'nodejs'
export const maxDuration = 60

// Quantos produtos processar em paralelo por leva: rápido o bastante para
// caber no maxDuration, sem disparar chamadas demais de uma vez à API.
const CONCURRENCY = 4

const weightSchema = {
  type: 'object',
  properties: {
    net_weight_kg: {
      type: ['number', 'null'],
      description:
        'Peso líquido em quilogramas, convertido a partir do valor impresso no rótulo (ex.: "900g" vira 0.9). Use null se o peso não estiver legível ou impresso na embalagem — não estime.',
    },
  },
  required: ['net_weight_kg'],
  additionalProperties: false,
}

// image_url é um campo livre do cadastro de produto; sem esta checagem o fetch
// abaixo seria um SSRF (o servidor buscaria qualquer URL, inclusive endereços
// internos). Só permitimos imagens hospedadas no próprio storage do Supabase.
function isAllowedImageUrl(raw: string): boolean {
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL
  if (!base) return false
  try {
    const url = new URL(raw)
    return url.protocol === 'https:' && url.host === new URL(base).host
  } catch {
    return false
  }
}

async function extractWeightKg(client: Anthropic, imageUrl: string): Promise<number | null> {
  if (!isAllowedImageUrl(imageUrl)) return null
  const imgRes = await fetch(imageUrl)
  if (!imgRes.ok) return null
  const buf = Buffer.from(await imgRes.arrayBuffer())
  const base64 = buf.toString('base64')
  const contentType = imgRes.headers.get('content-type') ?? 'image/jpeg'
  const mediaType = (contentType.split(';')[0] || 'image/jpeg') as 'image/jpeg' | 'image/png' | 'image/webp' | 'image/gif'

  const response = await client.messages.create({
    model: 'claude-opus-5',
    max_tokens: 256,
    output_config: { format: { type: 'json_schema', schema: weightSchema } },
    messages: [
      {
        role: 'user',
        content: [
          { type: 'image', source: { type: 'base64', media_type: mediaType, data: base64 } },
          {
            type: 'text',
            text: 'Leia o peso líquido impresso no rótulo desta embalagem de suplemento alimentar e converta para quilogramas. Se o valor não estiver legível ou impresso na embalagem, retorne null — não estime.',
          },
        ],
      },
    ],
  })

  if (response.stop_reason === 'refusal') return null
  const textBlock = response.content.find((block) => block.type === 'text')
  if (!textBlock || textBlock.type !== 'text') return null

  try {
    const parsed = JSON.parse(textBlock.text)
    return typeof parsed.net_weight_kg === 'number' && parsed.net_weight_kg > 0 ? parsed.net_weight_kg : null
  } catch {
    return null
  }
}

// Preenche o peso (weight_kg) dos produtos já cadastrados que ainda não têm
// esse campo, lendo o rótulo na foto já salva de cada um. Roda sob demanda
// (botão em /admin/produtos), aplica o valor direto sem tela de revisão.
export async function POST() {
  const active = await resolveActiveCompany()
  if (!active.ok) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json({ error: 'ANTHROPIC_API_KEY não configurada' }, { status: 500 })
  }

  const supabase = await createClient()
  const { data: products } = await supabase
    .from('products')
    .select('id, image_url')
    .eq('company_id', active.companyId)
    .is('weight_kg', null)
    .not('image_url', 'is', null)

  const pending = products ?? []
  if (pending.length === 0) {
    return NextResponse.json({ updated: 0, skipped: 0, total: 0 })
  }

  const client = new Anthropic()
  let updated = 0
  let skipped = 0

  for (let i = 0; i < pending.length; i += CONCURRENCY) {
    const batch = pending.slice(i, i + CONCURRENCY)
    const results = await Promise.allSettled(
      batch.map(async (product) => {
        const weight = await extractWeightKg(client, product.image_url as string)
        if (!weight) return false
        const { error } = await supabase.from('products').update({ weight_kg: weight }).eq('id', product.id)
        return !error
      })
    )
    for (const [idx, result] of results.entries()) {
      if (result.status === 'fulfilled' && result.value) {
        updated++
      } else {
        skipped++
        if (result.status === 'rejected') {
          console.error('Falha ao extrair peso do produto', batch[idx].id, result.reason)
        }
      }
    }
  }

  return NextResponse.json({ updated, skipped, total: pending.length })
}
