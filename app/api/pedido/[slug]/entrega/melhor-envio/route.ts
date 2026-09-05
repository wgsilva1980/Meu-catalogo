import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import {
  calculateShipping,
  pickShippingBox,
  resolveShippingBoxes,
  type PackableItem,
  type ShippingQuoteItem,
} from '@/lib/melhorEnvio'

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
  if (zipCode.replace(/\D/g, '').length !== 8) {
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

  const boxes = resolveShippingBoxes(company)
  if (!company.shipping_origin_zip_code || boxes.length === 0) {
    return NextResponse.json(
      { error: 'Frete via Melhor Envio não está disponível para esta loja.' },
      { status: 422 }
    )
  }

  const productIds = cartItems.map((i) => i.product_id)
  const { data: products } = await supabase
    .from('products')
    .select('id, weight_kg, length_cm, width_cm, height_cm, price')
    .eq('company_id', company.id)
    .eq('available', true)
    .in('id', productIds)

  const quoteItems: ShippingQuoteItem[] = []
  const packItems: PackableItem[] = []
  for (const item of cartItems) {
    const product = (products ?? []).find((p) => p.id === item.product_id)
    if (!product?.weight_kg || !product.length_cm || !product.width_cm || !product.height_cm) {
      return NextResponse.json(
        { error: 'Um ou mais produtos do carrinho não têm peso/dimensões cadastrados. Fale com a loja.' },
        { status: 422 }
      )
    }
    quoteItems.push({
      weight_kg: Number(product.weight_kg),
      quantity: item.quantity,
      insurance_value: Number(product.price) * item.quantity,
    })
    packItems.push({
      weight_kg: Number(product.weight_kg),
      length_cm: Number(product.length_cm),
      width_cm: Number(product.width_cm),
      height_cm: Number(product.height_cm),
      quantity: item.quantity,
    })
  }

  const picked = pickShippingBox(boxes, packItems)!

  try {
    const options = await calculateShipping({
      companyId: company.id,
      fromPostalCode: company.shipping_origin_zip_code,
      toPostalCode: zipCode,
      items: quoteItems,
      packageBox: {
        length_cm: picked.box.length_cm,
        width_cm: picked.box.width_cm,
        height_cm: picked.box.height_cm,
      },
      preferredCarrierCompanyId: company.shipping_origin_carrier_id ?? null,
    })
    if (options.length === 0) {
      return NextResponse.json({ error: 'Nenhuma opção de frete disponível para este CEP.' }, { status: 422 })
    }
    return NextResponse.json({ options })
  } catch (err) {
    console.error('Falha ao calcular frete (público):', err)
    const message = err instanceof Error ? err.message : 'Não foi possível calcular o frete.'
    return NextResponse.json({ error: message }, { status: 502 })
  }
}
