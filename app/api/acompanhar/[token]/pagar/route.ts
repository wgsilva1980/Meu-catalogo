import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { createPayment, normalizePaymentStatus } from '@/lib/mercadoPago'
import { recordPaymentResult } from '@/lib/orderPayments'
import { toMercadoPagoIdentification } from '@/lib/cpfCnpj'

export const runtime = 'nodejs'
export const maxDuration = 30

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

// Recebe o `formData` do Payment Brick (cartão ou Pix) e cria o pagamento
// direto no Mercado Pago — sem preferência/redirect. O token do pedido é a
// credencial — sem login.
export async function POST(request: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  if (!UUID_RE.test(token)) return NextResponse.json({ error: 'Link inválido.' }, { status: 404 })

  let body: {
    idempotencyKey?: string
    formData?: {
      payment_method_id?: string
      token?: string
      installments?: number
      issuer_id?: string | number
      payer?: { email?: string; identification?: { type?: string; number?: string } }
    }
  } = {}
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Requisição inválida.' }, { status: 400 })
  }
  const formData = body.formData
  const idempotencyKey = body.idempotencyKey
  if (!idempotencyKey || !formData?.payment_method_id || !formData.payer?.email) {
    return NextResponse.json({ error: 'Dados de pagamento incompletos.' }, { status: 422 })
  }

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

  const host = request.headers.get('host')
  const protocol = host?.startsWith('localhost') ? 'http' : 'https'
  const origin = `${protocol}://${host}`

  // Só repassa o que o backend precisa — nunca o `formData` inteiro — e
  // recalcula o valor a partir do pedido, nunca do que o Brick mandou.
  const identification =
    formData.payer.identification?.type && formData.payer.identification.number
      ? toMercadoPagoIdentification(formData.payer.identification.number)
      : null

  try {
    const payment = await createPayment({
      companyId: order.company_id,
      idempotencyKey,
      transactionAmount: Number(order.total),
      description: `Pedido #${order.number}`,
      externalReference: order.id,
      notificationUrl: `${origin}/api/mercado-pago/webhook`,
      paymentMethodId: formData.payment_method_id,
      token: formData.token,
      installments: formData.installments,
      issuerId: formData.issuer_id,
      payer: { email: formData.payer.email, identification },
    })

    await recordPaymentResult({ admin: supabase, companyId: order.company_id, orderId: order.id, payment, origin })

    const status = normalizePaymentStatus(payment.status)
    if (status === 'approved') return NextResponse.json({ status: 'approved' })
    if (status === 'rejected')
      return NextResponse.json({ status: 'rejected', paymentId: payment.id, statusDetail: payment.status_detail })
    return NextResponse.json({ status: 'pending', paymentId: payment.id })
  } catch (err) {
    console.error('Falha ao criar pagamento no Mercado Pago:', err)
    return NextResponse.json({ error: 'Não foi possível processar o pagamento agora.' }, { status: 502 })
  }
}
