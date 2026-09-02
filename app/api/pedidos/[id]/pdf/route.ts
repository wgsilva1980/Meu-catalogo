import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { resolveActiveCompany } from '@/lib/company'
import { buildOrderHtml } from '@/lib/pdf/orderTemplate'
import { renderHtmlToPdf } from '@/lib/pdf/browser'
import type { Company } from '@/lib/types'

export const runtime = 'nodejs'
export const maxDuration = 60

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const active = await resolveActiveCompany()
  if (!active.ok) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  const { companyId } = active

  const { id } = await params
  const supabase = await createClient()

  const { data: order } = await supabase
    .from('sales_orders')
    .select('*')
    .eq('id', id)
    .eq('company_id', companyId)
    .single()
  if (!order) return NextResponse.json({ error: 'Pedido não encontrado.' }, { status: 404 })

  const { data: items } = await supabase
    .from('sales_order_items')
    .select('*')
    .eq('order_id', id)
    .eq('company_id', companyId)

  const { data: customer } = await supabase
    .from('customers')
    .select('*')
    .eq('id', order.customer_id)
    .eq('company_id', companyId)
    .single()
  if (!customer) return NextResponse.json({ error: 'Cliente do pedido não encontrado.' }, { status: 400 })

  const { data: companyRow } = await supabase.from('companies').select('*').eq('id', companyId).single()
  const company: Company = companyRow ?? {
    id: companyId,
    name: 'Minha loja',
    slug: companyId,
    logo_url: null,
    phone: null,
    email: null,
    instagram: null,
    website: null,
    active: true,
    created_at: new Date().toISOString(),
  }

  let paymentMethodName: string | null = null
  if (order.payment_method_id) {
    const { data: pm } = await supabase
      .from('payment_methods')
      .select('name')
      .eq('id', order.payment_method_id)
      .eq('company_id', companyId)
      .maybeSingle()
    paymentMethodName = pm?.name ?? null
  }

  const { data: shipment } = await supabase
    .from('shipments')
    .select('service_name, tracking_code')
    .eq('order_id', id)
    .eq('company_id', companyId)
    .maybeSingle()

  const html = buildOrderHtml({
    company,
    customer,
    order,
    items: items ?? [],
    paymentMethodName,
    shipping: shipment ? { serviceName: shipment.service_name, trackingCode: shipment.tracking_code } : null,
  })

  try {
    const pdfBuffer = await renderHtmlToPdf(html)

    const admin = createAdminClient()
    const path = `${companyId}/pedido-${order.number}-${Date.now()}.pdf`
    const { error: uploadError } = await admin.storage.from('pedidos').upload(path, pdfBuffer, {
      contentType: 'application/pdf',
    })
    if (uploadError) {
      return NextResponse.json({ error: 'Falha ao salvar o PDF gerado.' }, { status: 500 })
    }

    const { data: signed } = await admin.storage.from('pedidos').createSignedUrl(path, 60 * 60 * 24 * 7)

    await supabase.from('sales_orders').update({ pdf_path: path }).eq('id', id).eq('company_id', companyId)

    return NextResponse.json({ url: signed?.signedUrl })
  } catch (err) {
    console.error('[pedidos/pdf]', err)
    return NextResponse.json({ error: 'Erro ao gerar o PDF.' }, { status: 500 })
  }
}
