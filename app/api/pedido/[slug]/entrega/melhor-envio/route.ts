import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { quoteMelhorEnvioForCart } from '@/lib/melhorEnvio'
import { isValidZipCode } from '@/lib/format'

export const runtime = 'nodejs'
export const maxDuration = 30

const MAX_ITEMS = 200

// Cotação de frete via Melhor Envio para o link PÚBLICO de pedido. Devolve só
// as opções de transportadora/preço — nenhum token da loja é exposto. Sem
// autenticação: usa o client admin e resolve a empresa pelo slug, igual à
// cotação de motoboy.
export async function POST(request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params

  let body: Record<string, unknown> = {}
  try {
    body = (await request.json()) as Record<string, unknown>
  } catch {
    return NextResponse.json({ error: 'Dados inválidos.' }, { status: 400 })
  }

  // honeypot: bots preenchem tudo
  if (typeof body.company_website === 'string' && body.company_website.trim().length > 0) {
    return NextResponse.json({ error: 'Requisição rejeitada.' }, { status: 400 })
  }

  const zipCode = typeof body.zip_code === 'string' ? body.zip_code.trim() : ''
  if (!isValidZipCode(zipCode)) {
    return NextResponse.json({ error: 'Informe um CEP válido.' }, { status: 422 })
  }

  const rawItems = Array.isArray(body.items) ? body.items.slice(0, MAX_ITEMS) : []
  const cartItems = rawItems
    .map((raw) => {
      if (!raw || typeof raw !== 'object') return null
      const product_id = (raw as Record<string, unknown>).product_id
      const quantity = Math.floor(Number((raw as Record<string, unknown>).quantity))
      if (typeof product_id !== 'string' || !Number.isFinite(quantity) || quantity <= 0) return null
      return { product_id, quantity }
    })
    .filter((i): i is { product_id: string; quantity: number } => i !== null)

  if (cartItems.length === 0) {
    return NextResponse.json({ error: 'Selecione ao menos um produto antes de calcular o frete.' }, { status: 422 })
  }

  const supabase = createAdminClient()
  const { data: company } = await supabase
    .from('companies')
    .select(
      'id, shipping_origin_zip_code, shipping_origin_carrier_id, shipping_packages, shipping_package_length_cm, shipping_package_width_cm, shipping_package_height_cm'
    )
    .eq('slug', slug)
    .eq('active', true)
    .maybeSingle()

  if (!company) return NextResponse.json({ error: 'Loja não encontrada.' }, { status: 404 })

  const result = await quoteMelhorEnvioForCart({ company, destinationZip: zipCode, items: cartItems })
  if (!result.ok) {
    const status = result.reason === 'quote_failed' ? 502 : 422
    return NextResponse.json({ error: result.message }, { status })
  }
  if (result.options.length === 0) {
    return NextResponse.json({ error: 'Nenhuma opção de frete disponível para este CEP.' }, { status: 422 })
  }
  return NextResponse.json({ options: result.options })
}
