import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { resolveActiveCompany } from '@/lib/company'
import { calculateShipping, type ShippingQuoteItem } from '@/lib/melhorEnvio'

export const runtime = 'nodejs'
export const maxDuration = 30

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const active = await resolveActiveCompany()
  if (!active.ok) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const { id } = await params
  const supabase = await createClient()

  const { data: order } = await supabase
    .from('sales_orders')
    .select('id, customer_id')
    .eq('id', id)
    .eq('company_id', active.companyId)
    .single()
  if (!order) return NextResponse.json({ error: 'Pedido não encontrado' }, { status: 404 })

  const [{ data: company }, { data: customer }, { data: items }] = await Promise.all([
    supabase.from('companies').select('*').eq('id', active.companyId).single(),
    supabase.from('customers').select('*').eq('id', order.customer_id).single(),
    supabase.from('sales_order_items').select('product_id, quantity, unit_price').eq('order_id', id).eq('company_id', active.companyId),
  ])

  if (!company?.shipping_origin_zip_code) {
    return NextResponse.json({ error: 'Cadastre o endereço de origem em Configurações antes de calcular frete.' }, { status: 422 })
  }
  if (!customer?.zip_code) {
    return NextResponse.json({ error: 'Este cliente não tem CEP cadastrado. Edite o cliente antes de calcular frete.' }, { status: 422 })
  }
  if (!items || items.length === 0) {
    return NextResponse.json({ error: 'Pedido sem itens.' }, { status: 422 })
  }

  const productIds = items.map((item) => item.product_id)
  const { data: products } = await supabase
    .from('products')
    .select('id, weight_kg, length_cm, width_cm, height_cm')
    .in('id', productIds)

  const missingDimensions: string[] = []
  const quoteItems: ShippingQuoteItem[] = []
  for (const item of items) {
    const product = (products ?? []).find((p) => p.id === item.product_id)
    if (!product?.weight_kg || !product.length_cm || !product.width_cm || !product.height_cm) {
      missingDimensions.push(item.product_id)
      continue
    }
    quoteItems.push({
      weight_kg: Number(product.weight_kg),
      length_cm: Number(product.length_cm),
      width_cm: Number(product.width_cm),
      height_cm: Number(product.height_cm),
      quantity: item.quantity,
      insurance_value: Number(item.unit_price) * item.quantity,
    })
  }

  if (missingDimensions.length > 0) {
    return NextResponse.json(
      { error: 'Um ou mais produtos deste pedido não têm peso/dimensões cadastrados. Preencha em Produtos antes de calcular frete.' },
      { status: 422 }
    )
  }

  try {
    const options = await calculateShipping({
      companyId: active.companyId,
      fromPostalCode: company.shipping_origin_zip_code,
      toPostalCode: customer.zip_code,
      items: quoteItems,
    })
    return NextResponse.json({ options })
  } catch (err) {
    console.error('Falha ao calcular frete:', err)
    const message = err instanceof Error ? err.message : 'Falha ao calcular frete.'
    return NextResponse.json({ error: message }, { status: 502 })
  }
}
