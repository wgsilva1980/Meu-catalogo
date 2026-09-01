import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { resolveMotoQuote } from '@/lib/lalamove'

export const runtime = 'nodejs'
export const maxDuration = 30

// Cotação de motoboy para o link PÚBLICO de pedido. Só devolve um preço —
// nenhuma chave da Lalamove é exposta. Sem autenticação: usa o client admin
// e resolve a empresa pelo slug.
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

  const clean = (v: unknown, max = 160) => (typeof v === 'string' ? v.trim().slice(0, max) : null)
  const destination = {
    zip_code: clean(body.zip_code, 12),
    street: clean(body.street),
    number: clean(body.number, 20),
    neighborhood: clean(body.neighborhood, 120),
    city: clean(body.city, 120),
    state: clean(body.state, 20),
  }

  const supabase = createAdminClient()
  const { data: company } = await supabase
    .from('companies')
    .select(
      'id, lalamove_enabled, lalamove_service_type, shipping_origin_zip_code, shipping_origin_street, shipping_origin_number, shipping_origin_neighborhood, shipping_origin_city, shipping_origin_state, shipping_origin_lat, shipping_origin_lng'
    )
    .eq('slug', slug)
    .eq('active', true)
    .maybeSingle()

  if (!company) return NextResponse.json({ error: 'Loja não encontrada.' }, { status: 404 })
  if (!company.lalamove_enabled) {
    return NextResponse.json({ error: 'Entrega por motoboy não está habilitada para esta loja.' }, { status: 422 })
  }

  const result = await resolveMotoQuote({ company, destination })
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status })
  }

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
