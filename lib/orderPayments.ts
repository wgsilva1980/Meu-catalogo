// Aplica o resultado de um pagamento do Mercado Pago a um pedido. Chamado
// tanto pela resposta síncrona da criação do pagamento (cartão aprovado na
// hora) quanto pelo webhook (Pix, ou notificações repetidas do próprio MP) —
// os dois caminhos podem disparar para o mesmo pedido, então a "primeira
// aprovação" (avançar status, baixar estoque, mandar e-mail) é resolvida de
// forma atômica no banco (`claim_order_payment`), não em JS.
import type { SupabaseClient } from '@supabase/supabase-js'
import type { MercadoPagoPayment } from '@/lib/mercadoPago'
import { normalizePaymentStatus } from '@/lib/mercadoPago'
import { sendNotificationEmail } from '@/lib/email'
import { buildPaymentConfirmedEmail } from '@/lib/emailTemplates'

export async function recordPaymentResult({
  admin,
  companyId,
  orderId,
  payment,
  origin,
}: {
  admin: SupabaseClient
  companyId: string
  orderId: string
  payment: MercadoPagoPayment
  origin: string
}): Promise<void> {
  const status = normalizePaymentStatus(payment.status)
  const paidAt = status === 'approved' ? payment.date_approved || new Date().toISOString() : null

  await admin.from('payments').upsert(
    {
      company_id: companyId,
      order_id: orderId,
      provider: 'mercado_pago',
      mp_payment_id: payment.id,
      status,
      amount: payment.transaction_amount,
      paid_at: paidAt,
      raw: payment as unknown as Record<string, unknown>,
    },
    { onConflict: 'order_id' }
  )

  if (status !== 'approved') {
    // Estorno/chargeback depois de uma aprovação anterior: desfaz só o
    // `paid_at` (mesmo comportamento que o webhook antigo já tinha) — não
    // mexe em `status` nem tenta repor estoque automaticamente, porque a
    // essa altura o pedido já pode ter seguido pra separação/envio; reverter
    // isso sozinho é decisão de quem opera a loja, não do webhook.
    if (status === 'refunded' || status === 'cancelled') {
      const { error } = await admin
        .from('sales_orders')
        .update({ paid_at: null })
        .eq('id', orderId)
        .eq('company_id', companyId)
      if (error) console.error('Falha ao reverter paid_at após estorno/cancelamento:', error)
    }
    return
  }

  // Atômico: só quem "ganha" a corrida recebe a linha de volta — uma
  // notificação duplicada do Mercado Pago, ou o outro caminho (síncrono vs
  // webhook) chegando ao mesmo tempo, não repete baixa de estoque nem e-mail.
  // Também não reivindica nada pra um pedido cancelado ou pra estoque que
  // faltou (esse último caso ainda volta `stock_ok: false`, tratado abaixo).
  const { data: claimed, error } = await admin.rpc('claim_order_payment', {
    p_company_id: companyId,
    p_order_id: orderId,
    p_paid_at: paidAt,
  })
  if (error) {
    console.error('Falha ao aplicar aprovação do pagamento no pedido:', error)
    return
  }
  const order = Array.isArray(claimed) ? claimed[0] : claimed
  if (!order) return

  if (order.stock_ok === false) {
    // Pagamento aprovado e `paid_at` já gravado — só o estoque não baixou.
    // Não é motivo pra deixar de notificar o cliente; precisa de revisão
    // manual do lado da loja (ver aviso já logado dentro da função SQL).
    console.error(
      `Pedido ${order.number} (empresa ${companyId}) foi pago mas o estoque não pôde ser baixado — revisar manualmente.`
    )
  }

  if (!order.customer_id || !order.public_token) return
  try {
    const [{ data: customer }, { data: company }] = await Promise.all([
      admin.from('customers').select('name, email').eq('id', order.customer_id).maybeSingle(),
      admin.from('companies').select('name').eq('id', companyId).single(),
    ])
    if (!customer?.email) return

    const trackingUrl = `${origin}/acompanhar/${order.public_token}`
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
  } catch (err) {
    console.error('Falha ao enviar e-mail de pagamento confirmado:', err)
  }
}
