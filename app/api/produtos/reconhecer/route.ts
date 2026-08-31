import { NextRequest, NextResponse } from 'next/server'
import Anthropic, { APIError } from '@anthropic-ai/sdk'
import { resolveActiveCompany } from '@/lib/company'

type RecognizedProduct = {
  name: string
  brand: string
  category: string
  short_description: string
  net_weight_kg: number | null
}

export async function POST(request: NextRequest) {
  const active = await resolveActiveCompany()
  if (!active.ok) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  }

  const formData = await request.formData()
  const file = formData.get('file') as File | null
  const categoriesRaw = formData.get('categories') as string | null

  if (!file || file.size === 0) {
    return NextResponse.json({ error: 'Nenhuma imagem enviada' }, { status: 400 })
  }
  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json({ error: 'ANTHROPIC_API_KEY não configurada' }, { status: 500 })
  }

  let categories: { id: string; name: string }[] = []
  if (categoriesRaw) {
    try {
      const raw = JSON.parse(categoriesRaw)
      if (Array.isArray(raw)) {
        categories = raw.filter(
          (c): c is { id: string; name: string } =>
            c && typeof c.id === 'string' && typeof c.name === 'string'
        )
      }
    } catch {
      return NextResponse.json({ error: 'Lista de categorias inválida' }, { status: 400 })
    }
  }
  const categoryNames = categories.map((c) => c.name)

  const bytes = Buffer.from(await file.arrayBuffer())
  const base64 = bytes.toString('base64')
  const mediaType = (file.type || 'image/jpeg') as 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp'

  const schema = {
    type: 'object',
    properties: {
      name: { type: 'string', description: 'Nome do produto, sem a marca' },
      brand: { type: 'string', description: 'Marca ou fabricante do produto' },
      category: {
        type: 'string',
        description: 'Categoria mais adequada dentre as opções fornecidas',
        ...(categoryNames.length ? { enum: categoryNames } : {}),
      },
      short_description: { type: 'string', description: 'Descrição curta (1 a 2 frases) para o catálogo, em português' },
      net_weight_kg: {
        type: ['number', 'null'],
        description:
          'Peso líquido do produto em quilogramas, convertido a partir do valor impresso no rótulo (ex.: "900g" vira 0.9, "60 cápsulas" sem peso em gramas vira null). Use null se o peso não estiver legível ou impresso na embalagem — não estime.',
      },
    },
    required: ['name', 'brand', 'category', 'short_description', 'net_weight_kg'],
    additionalProperties: false,
  }

  const client = new Anthropic()

  let response
  try {
    response = await client.messages.create({
      model: 'claude-opus-5',
      max_tokens: 1024,
      output_config: { format: { type: 'json_schema', schema } },
      messages: [
        {
          role: 'user',
          content: [
            { type: 'image', source: { type: 'base64', media_type: mediaType, data: base64 } },
            {
              type: 'text',
              text: `Você está ajudando a cadastrar um produto em um catálogo de loja de suplementos alimentares. Analise a foto da embalagem e identifique: nome do produto (sem a marca), marca, categoria mais adequada${
                categoryNames.length ? ` (escolha exatamente uma entre: ${categoryNames.join(', ')})` : ''
              }, uma descrição curta (1 a 2 frases) para o catálogo em português, e o peso líquido em quilogramas lido diretamente do valor impresso no rótulo (ex.: "900g" → 0.9). Se não tiver certeza de nome/marca/categoria/descrição, forneça sua melhor estimativa com base no que é visível na embalagem — mas para o peso, use null se o valor não estiver legível ou impresso, não estime.`,
            },
          ],
        },
      ],
    })
  } catch (err) {
    console.error('Erro ao chamar a API da Anthropic:', err)
    const status = err instanceof APIError ? err.status : undefined
    const detail = status ? `código ${status}` : 'erro de conexão'
    return NextResponse.json({ error: `Falha ao identificar o produto (${detail})` }, { status: 502 })
  }

  if (response.stop_reason === 'refusal') {
    console.error('Reconhecimento de produto recusado pelo modelo', { fileSize: file.size, mediaType })
    return NextResponse.json({ error: 'Não foi possível identificar o produto nesta imagem' }, { status: 422 })
  }

  const textBlock = response.content.find((block) => block.type === 'text')
  if (!textBlock || textBlock.type !== 'text') {
    console.error('Resposta do reconhecimento sem bloco de texto', { stop_reason: response.stop_reason, content: response.content })
    return NextResponse.json({ error: 'Resposta vazia do reconhecimento' }, { status: 502 })
  }

  let parsed: RecognizedProduct
  try {
    parsed = JSON.parse(textBlock.text)
  } catch (err) {
    console.error('Resposta do reconhecimento não é um JSON válido', { text: textBlock.text, err })
    return NextResponse.json({ error: 'Resposta inválida do reconhecimento' }, { status: 502 })
  }

  const matchedCategory = categories.find((c) => c.name.toLowerCase() === parsed.category?.toLowerCase())

  return NextResponse.json({
    name: parsed.name,
    brand: parsed.brand,
    category_id: matchedCategory?.id ?? null,
    short_description: parsed.short_description,
    weight_kg: parsed.net_weight_kg ?? null,
  })
}
