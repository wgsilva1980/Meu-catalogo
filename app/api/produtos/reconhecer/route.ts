import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@/lib/supabase/server'

type RecognizedProduct = {
  name: string
  brand: string
  category: string
  short_description: string
}

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
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

  const categories: { id: string; name: string }[] = categoriesRaw ? JSON.parse(categoriesRaw) : []
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
    },
    required: ['name', 'brand', 'category', 'short_description'],
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
              }, e uma descrição curta (1 a 2 frases) para o catálogo, em português. Se não tiver certeza de algum campo, forneça sua melhor estimativa com base no que é visível na embalagem.`,
            },
          ],
        },
      ],
    })
  } catch (err) {
    console.error('Erro ao chamar a API da Anthropic:', err)
    return NextResponse.json({ error: 'Falha ao identificar o produto' }, { status: 502 })
  }

  if (response.stop_reason === 'refusal') {
    return NextResponse.json({ error: 'Não foi possível identificar o produto nesta imagem' }, { status: 422 })
  }

  const textBlock = response.content.find((block) => block.type === 'text')
  if (!textBlock || textBlock.type !== 'text') {
    return NextResponse.json({ error: 'Resposta vazia do reconhecimento' }, { status: 502 })
  }

  let parsed: RecognizedProduct
  try {
    parsed = JSON.parse(textBlock.text)
  } catch {
    return NextResponse.json({ error: 'Resposta inválida do reconhecimento' }, { status: 502 })
  }

  const matchedCategory = categories.find((c) => c.name.toLowerCase() === parsed.category?.toLowerCase())

  return NextResponse.json({
    name: parsed.name,
    brand: parsed.brand,
    category_id: matchedCategory?.id ?? null,
    short_description: parsed.short_description,
  })
}
