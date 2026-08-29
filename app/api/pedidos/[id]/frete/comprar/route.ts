import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { resolveActiveCompany } from '@/lib/company'
import { purchaseAndGenerateLabel, type ShippingAddress, type ShippingQuoteItem } from '@/lib/melhorEnvio'

export const runtime = 'nodejs'
export const maxDuration = 60

// Compra a etiqueta de verdade (gasta saldo da carteira do Melhor Envio) e
// já gera + pega o link de impressão. Só é chamado por um clique explícito
// do admin — nunca automaticamente.
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const active = await resolveActiveCompany()
  if (!active.ok) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const { id } = await params
  let body: { service_id?: number; service_name?: string; price?: number }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Corpo da requisição inválido.' }, { status: 400 })
  }
  if (!body.service_id) return NextResponse.json({ error: 'Selecione uma opção de frete.' }, { status: 400 })

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

  if (!company?.shipping_origin_zip_code || !customer?.zip_code || !items || items.length === 0) {
    return NextResponse.json({ error: 'Dados incompletos para gerar a etiqueta. Calcule o frete novamente.' }, { status: 422 })
  }

  const productIds = items.map((item) => item.product_id)
  const { data: products } = await supabase
    .from('products')
    .select('id, name, weight_kg, length_cm, width_cm, height_cm')
    .in('id', productIds)

  const quoteItems: ShippingQuoteItem[] = []
  for (const item of items) {
    const product = (products ?? []).find((p) => p.id === item.product_id)
    if (!product?.weight_kg || !product.length_cm || !product.width_cm || !product.height_cm) {
      return NextResponse.json({ error: 'Um ou mais produtos deste pedido não têm peso/dimensões cadastrados.' }, { status: 422 })
    }
    quoteItems.push({
      weight_kg: Number(product.weight_kg),
      length_cm: Number(product.length_cm),
      width_cm: Number(product.width_cm),
      height_cm: Number(product.height_cm),
      quantity: item.quantity,
      insurance_value: Number(item.unit_price) * item.quantity,
      name: product.name,
      unit_value: Number(item.unit_price),
    })
  }

  const from: ShippingAddress = {
    name: company.shipping_origin_name || company.name,
    phone: company.shipping_origin_phone,
    email: company.shipping_origin_email,
    document: company.shipping_origin_document,
    address: company.shipping_origin_street || '',
    number: company.shipping_origin_number || 'S/N',
    complement: company.shipping_origin_complement,
    district: company.shipping_origin_neighborhood || '',
    city: company.shipping_origin_city || '',
    postal_code: company.shipping_origin_zip_code,
    state_abbr: company.shipping_origin_state || '',
  }
  const to: ShippingAddress = {
    name: customer.name,
    phone: customer.phone,
    email: customer.email,
    document: customer.document,
    address: customer.street || '',
    number: customer.number || 'S/N',
    complement: customer.complement,
    district: customer.neighborhood || '',
    city: customer.city || '',
    postal_code: customer.zip_code,
    state_abbr: customer.state || '',
  }

  try {
    const result = await purchaseAndGenerateLabel({
      companyId: active.companyId,
      serviceId: body.service_id,
      from,
      to,
      items: quoteItems,
    })

    const admin = createAdminClient()
    await admin.from('shipments').upsert(
      {
        company_id: active.companyId,
        order_id: id,
        melhor_envio_id: result.melhorEnvioId,
        service_id: body.service_id,
        service_name: body.service_name ?? null,
        price: body.price ?? null,
        status: 'gerado',
        print_url: result.printUrl,
      },
      { onConflict: 'order_id' }
    )

    return NextResponse.json({ printUrl: result.printUrl })
  } catch (err) {
    console.error('Falha ao comprar/gerar etiqueta:', err)
    const message = err instanceof Error ? err.message : 'Falha ao gerar etiqueta.'
    return NextResponse.json({ error: message }, { status: 502 })
  }
}
