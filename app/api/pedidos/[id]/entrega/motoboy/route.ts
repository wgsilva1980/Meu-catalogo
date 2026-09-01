import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { resolveActiveCompany } from '@/lib/company'
import { resolveMotoQuote } from '@/lib/lalamove'

export const runtime = 'nodejs'
export const maxDuration = 30

// Recotação de motoboy a partir do painel, usando o endereço do cliente do
// pedido. Não grava nada — quem grava é a action ao salvar o pedido.
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

  const [{ data: company }, { data: customer }] = await Promise.all([
    supabase.from('companies').select('*').eq('id', active.companyId).single(),
    supabase.from('customers').select('*').eq('id', order.customer_id).single(),
  ])

  if (!company?.lalamove_enabled) {
    return NextResponse.json({ error: 'Ative "Motoboy (Lalamove)" em Configurações antes de cotar.' }, { status: 422 })
  }
  if (!customer?.zip_code) {
    return NextResponse.json({ error: 'Este cliente não tem CEP cadastrado. Edite o cliente antes de cotar.' }, { status: 422 })
  }

  const result = await resolveMotoQuote({
    company,
    destination: {
      zip_code: customer.zip_code,
      street: customer.street,
      number: customer.number,
      neighborhood: customer.neighborhood,
      city: customer.city,
      state: customer.state,
    },
  })
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status })

  if (!result.originGeoWasCached) {
    await supabase
      .from('companies')
      .update({ shipping_origin_lat: result.originGeo.lat, shipping_origin_lng: result.originGeo.lng })
      .eq('id', company.id)
  }

  const { quote } = result
  return NextResponse.json({
    fee: quote.total,
    currency: quote.currency,
    distanceKm: quote.distanceMeters != null ? Math.round(quote.distanceMeters / 100) / 10 : null,
    quotationId: quote.quotationId,
    serviceType: quote.serviceType,
    expiresAt: quote.expiresAt,
  })
}
