import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getConnectedCompanyId, getPayment, normalizePaymentStatus, verifyWebhookSignature } from '@/lib/mercadoPago'
import { sendNotificationEmail } from '@/lib/email'
import { buildPaymentConfirmedEmail } from '@/lib/emailTemplates'

export const runtime = 'nodejs'
export const maxDuration = 30

// Webhook do Mercado Pago. Recebe notificações de pagamento, confirma na API
// e atualiza `payments` + `sales_orders.paid_at`. Idempotente.
export async function POST(request: Request) {
  const url = new URL(request.url)
  let body: Record<string, unknown> = {}
  try {
    body = (await request.json()) as Record<string, unknown>
  } catch {
    // algumas notificações vêm só com query string
  }

  const type = (body.type as string) || url.searchParams.get('type') || url.searchParams.get('topic')
  // A assinatura do Mercado Pago é calculada sobre o `data.id` da query
  // string; por isso ele vem primeiro aqui.
  const dataId =
    url.searchParams.get('data.id') ||
    url.searchParams.get('id') ||
    ((body.data as { id?: unknown } | undefined)?.id as string | undefined)

  // Só tratamos notificações de pagamento.
  if (type !== 'payment' || !dataId) {
    return NextResponse.json({ ok: true, ignored: true })
  }

  const valid = verifyWebhookSignature({
    dataId: String(dataId),
    requestId: request.headers.get('x-request-id'),
    signatureHeader: request.headers.get('x-signature'),
  })
  if (!valid) {
    console.warn('Webhook do Mercado Pago com assinatura inválida.')
    return NextResponse.json({ error: 'assinatura inválida' }, { status: 401 })
  }

  const mpUserId = body.user_id != null ? String(body.user_id) : url.searchParams.get('user_id')
  if (!mpUserId) {
    console.error('Webhook do Mercado Pago sem user_id — não dá para resolver a loja.', body)
    return NextResponse.json({ ok: true })
  }

  const companyId = await getConnectedCompanyId(mpUserId)
  if (!companyId) {
    console.error('Webhook do Mercado Pago: nenhuma loja conectada para user_id', mpUserId)
    return NextResponse.json({ ok: true })
  }

  const payment = await getPayment({ companyId, paymentId: String(dataId) })
  if (!payment || !payment.external_reference) {
    console.error('Webhook do Mercado Pago: pagamento não encontrado ou sem external_reference', dataId)
    return NextResponse.json({ ok: true })
  }

  const status = normalizePaymentStatus(payment.status)
  const paidAt = status === 'approved' ? payment.date_approved || new Date().toISOString() : null

  const admin = createAdminClient()

  // Estado do pedido antes de mexer em nada — é o que diz se essa é a
  // *primeira* aprovação (dispara baixa de estoque e e-mail) ou uma
  // notificação repetida do Mercado Pago para o mesmo pagamento.
  const { data: order } = await admin
    .from('sales_orders')
    .select('id, number, status, paid_at, customer_id, public_token')
    .eq('id', payment.external_reference)
    .eq('company_id', companyId)
    .maybeSingle()

  await admin.from('payments').upsert(
    {
      company_id: companyId,
      order_id: payment.external_reference,
      provider: 'mercado_pago',
      mp_payment_id: payment.id,
      status,
      amount: payment.transaction_amount,
      paid_at: paidAt,
      raw: payment as unknown as Record<string, unknown>,
    },
    { onConflict: 'order_id' }
  )

  const isFirstApproval = status === 'approved' && !order?.paid_at
  // Pagamento aprovado tira o pedido de "rascunho" — vira "confirmado", o
  // mesmo estágio que o admin usa manualmente para dizer "pode preparar o
  // envio" (não existe um status à parte só para isso).
  const nextStatus = isFirstApproval && order?.status === 'rascunho' ? 'confirmado' : undefined

  await admin
    .from('sales_orders')
    .update({ paid_at: paidAt, ...(nextStatus ? { status: nextStatus } : {}) })
    .eq('id', payment.external_reference)
    .eq('company_id', companyId)

  if (isFirstApproval && order) {
    // Baixa de estoque só quando o pedido ainda não tinha sido confirmado
    // por outro caminho (ex.: admin confirmou manualmente antes do cliente
    // pagar) — nesse caso o estoque já foi baixado e baixar de novo duplicaria.
    if (nextStatus === 'confirmado') {
      const { error } = await admin.rpc('commit_order_stock', { p_company_id: companyId, p_order_id: order.id })
      if (error) console.error('Falha ao baixar estoque após pagamento aprovado:', error)
    }

    // E-mail de confirmação pro cliente, com o link de acompanhamento —
    // melhor esforço, nunca deve derrubar a confirmação do pagamento.
    if (order.customer_id && order.public_token) {
      try {
        const [{ data: customer }, { data: company }] = await Promise.all([
          admin.from('customers').select('name, email').eq('id', order.customer_id).maybeSingle(),
          admin.from('companies').select('name').eq('id', companyId).single(),
        ])
        if (customer?.email) {
          const host = request.headers.get('host')
          const protocol = host?.startsWith('localhost') ? 'http' : 'https'
          const trackingUrl = `${protocol}://${host}/acompanhar/${order.public_token}`
          const html = buildPaymentConfirmedEmail({
            companyName: company?.name ?? '',
            customerName: customer.name,
            orderNumber: order.number,
            trackingUrl,
          })
          await sendNotificationEmail({
            to: customer.email,
            subject: `Pagamento confirmado — Pedido #${order.number}`,
            html,
          })
        }
      } catch (err) {
        console.error('Falha ao enviar e-mail de pagamento confirmado:', err)
      }
    }
  }

  return NextResponse.json({ ok: true })
}
