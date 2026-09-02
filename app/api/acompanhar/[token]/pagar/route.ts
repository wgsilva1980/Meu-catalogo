import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { createCheckoutPreference } from '@/lib/mercadoPago'

export const runtime = 'nodejs'
export const maxDuration = 30

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

// Cria a cobrança no Mercado Pago para o pedido do link público de
// acompanhamento e devolve o link do checkout. O token do pedido é a
// credencial — sem login.
export async function POST(request: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  if (!UUID_RE.test(token)) return NextResponse.json({ error: 'Link inválido.' }, { status: 404 })

  const supabase = createAdminClient()
  const { data: order } = await supabase
    .from('sales_orders')
    .select('id, number, total, company_id, customer_id, paid_at')
    .eq('public_token', token)
    .maybeSingle()
  if (!order) return NextResponse.json({ error: 'Pedido não encontrado.' }, { status: 404 })

  if (order.paid_at) return NextResponse.json({ error: 'Este pedido já foi pago.' }, { status: 409 })
  if (!order.total || Number(order.total) <= 0) {
    return NextResponse.json({ error: 'Este pedido não tem valor a pagar.' }, { status: 422 })
  }

  const { data: account } = await supabase
    .from('mercado_pago_accounts')
    .select('company_id')
    .eq('company_id', order.company_id)
    .maybeSingle()
  if (!account) {
    return NextResponse.json({ error: 'A loja ainda não habilitou pagamento online.' }, { status: 422 })
  }

  const [{ data: company }, { data: customer }] = await Promise.all([
    supabase.from('companies').select('name').eq('id', order.company_id).single(),
    order.customer_id
      ? supabase.from('customers').select('name, email').eq('id', order.customer_id).maybeSingle()
      : Promise.resolve({ data: null }),
  ])

  const host = request.headers.get('host')
  const protocol = host?.startsWith('localhost') ? 'http' : 'https'
  const origin = `${protocol}://${host}`

  try {
    const pref = await createCheckoutPreference({
      companyId: order.company_id,
      order: { id: order.id, number: order.number, total: Number(order.total) },
      title: `Pedido #${order.number}${company?.name ? ` — ${company.name}` : ''}`,
      backUrl: `${origin}/acompanhar/${token}`,
      notificationUrl: `${origin}/api/mercado-pago/webhook`,
      payer: { name: customer?.name ?? null, email: customer?.email ?? null },
    })

    await supabase.from('payments').upsert(
      {
        company_id: order.company_id,
        order_id: order.id,
        provider: 'mercado_pago',
        mp_preference_id: pref.id,
        status: 'pending',
      },
      { onConflict: 'order_id' }
    )

    return NextResponse.json({ initPoint: pref.initPoint })
  } catch (err) {
    console.error('Falha ao criar cobrança no Mercado Pago:', err)
    return NextResponse.json({ error: 'Não foi possível iniciar o pagamento agora.' }, { status: 502 })
  }
}
