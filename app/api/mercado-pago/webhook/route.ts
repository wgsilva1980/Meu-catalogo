import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getConnectedCompanyId, getPayment, verifyWebhookSignature } from '@/lib/mercadoPago'
import { recordPaymentResult } from '@/lib/orderPayments'

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

  const admin = createAdminClient()
  const host = request.headers.get('host')
  const protocol = host?.startsWith('localhost') ? 'http' : 'https'

  await recordPaymentResult({
    admin,
    companyId,
    orderId: payment.external_reference,
    payment,
    origin: `${protocol}://${host}`,
  })

  return NextResponse.json({ ok: true })
}
