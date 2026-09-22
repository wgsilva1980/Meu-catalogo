import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { resolveActiveCompany } from '@/lib/company'
import { buildLabelHtml } from '@/lib/pdf/labelTemplate'
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

  const html = buildLabelHtml({ company, customer, order })

  try {
    const pdfBuffer = await renderHtmlToPdf(html)

    const admin = createAdminClient()
    const path = `${companyId}/etiqueta-${order.number}-${Date.now()}.pdf`
    const { error: uploadError } = await admin.storage.from('pedidos').upload(path, pdfBuffer, {
      contentType: 'application/pdf',
    })
    if (uploadError) {
      return NextResponse.json({ error: 'Falha ao salvar a etiqueta gerada.' }, { status: 500 })
    }

    const { data: signed } = await admin.storage.from('pedidos').createSignedUrl(path, 60 * 60 * 24 * 7)

    return NextResponse.json({ url: signed?.signedUrl })
  } catch (err) {
    console.error('[pedidos/etiqueta]', err)
    return NextResponse.json({ error: 'Erro ao gerar a etiqueta.' }, { status: 500 })
  }
}
