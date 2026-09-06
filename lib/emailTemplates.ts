// Templates de e-mail HTML. Ficam separados de lib/email.ts (que só cuida do
// envio) e usam apenas os campos que realmente precisam — não os tipos
// completos de lib/types — para não acoplar o template a colunas extras.
import { formatPrice } from '@/lib/format'

const statusLabel: Record<string, string> = {
  rascunho: 'Rascunho',
  confirmado: 'Confirmado',
  cancelado: 'Cancelado',
}

const deliveryLabel: Record<string, string> = {
  retirada: 'Retirar na loja',
  motoboy: 'Motoboy',
  melhor_envio: 'Melhor Envio',
  a_combinar: 'A combinar',
}

// Todo texto abaixo vem de formulários públicos sem autenticação, então
// precisa ser escapado antes de entrar no HTML do e-mail.
function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

export function buildOrderNotificationEmail({
  companyName,
  order,
  customer,
  items,
  delivery,
  paymentMethod,
  panelUrl,
}: {
  companyName: string
  order: { number: number; status: string; total: number; notes: string | null; createdAt: string }
  customer: { name: string; phone: string | null; email: string | null; document: string | null }
  items: { product_name: string; quantity: number; unit_price: number; subtotal: number }[]
  delivery?: { method: string; fee: number; address?: string | null } | null
  paymentMethod?: string | null
  panelUrl?: string | null
}) {
  const date = new Date(order.createdAt).toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  })

  const contactLines = [
    customer.phone ? `Telefone: ${escapeHtml(customer.phone)}` : null,
    customer.email ? `E-mail: ${escapeHtml(customer.email)}` : null,
    customer.document ? `CPF: ${escapeHtml(customer.document)}` : null,
  ]
    .filter(Boolean)
    .join('<br>')

  const itemsHtml = items
    .map(
      (item) => `
      <tr style="border-bottom:1px solid #DEDCD4;">
        <td style="padding:12px 0;">
          <div style="font-size:14px;font-weight:700;">${escapeHtml(item.product_name)}</div>
          <div style="font-size:12px;color:#5B6472;">${item.quantity}× ${formatPrice(item.unit_price)}</div>
        </td>
        <td align="right" style="font-size:14px;font-weight:700;white-space:nowrap;font-variant-numeric:tabular-nums;">${formatPrice(item.subtotal)}</td>
      </tr>`
    )
    .join('')

  const notesHtml = order.notes
    ? `
    <tr><td style="padding:16px 32px 4px;">
      <div style="font-size:11px;letter-spacing:0.08em;text-transform:uppercase;color:#5B6472;font-weight:700;margin-bottom:6px;">Observações</div>
      <div style="font-size:13px;color:#5B6472;background:#F4F5F1;border:1px solid #DEDCD4;border-radius:10px;padding:12px 14px;white-space:pre-wrap;">${escapeHtml(order.notes)}</div>
    </td></tr>`
    : ''

  const deliveryHtml = delivery
    ? `
    <tr><td style="padding:16px 32px 0;">
      <div style="font-size:11px;letter-spacing:0.08em;text-transform:uppercase;color:#5B6472;font-weight:700;margin-bottom:6px;">Entrega</div>
      <div style="font-size:13px;color:#12182A;">${escapeHtml(deliveryLabel[delivery.method] ?? delivery.method)}${
        delivery.fee > 0 ? ` — ${formatPrice(delivery.fee)}` : ''
      }</div>
      ${delivery.address ? `<div style="font-size:13px;color:#5B6472;margin-top:4px;">${escapeHtml(delivery.address)}</div>` : ''}
    </td></tr>`
    : ''

  const paymentHtml = paymentMethod
    ? `
    <tr><td style="padding:16px 32px 0;">
      <div style="font-size:11px;letter-spacing:0.08em;text-transform:uppercase;color:#5B6472;font-weight:700;margin-bottom:6px;">Forma de pagamento</div>
      <div style="font-size:13px;color:#12182A;">${escapeHtml(paymentMethod)}</div>
    </td></tr>`
    : ''

  const footerLink = panelUrl
    ? ` · <a href="${panelUrl}" style="color:#FF5A36;text-decoration:none;font-weight:700;">Ver no painel</a>`
    : ''

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Novo pedido #${order.number}</title>
<style>
  body { margin:0; padding:0; background:#F4F5F1; font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif; color:#12182A; }
  table { border-collapse:collapse; }
  .display { font-family:Georgia,"Times New Roman",serif; }
</style>
</head>
<body>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:32px 16px;">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#FFFFFF;border-radius:16px;overflow:hidden;border:1px solid #DEDCD4;">

  <tr><td style="background:#12182A;padding:26px 32px;">
    <div style="font-size:11px;letter-spacing:0.1em;text-transform:uppercase;color:rgba(255,255,255,0.6);font-weight:700;">🛒 Novo pedido recebido</div>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:6px;"><tr>
      <td class="display" style="color:#FFFFFF;font-size:26px;font-weight:700;">Pedido #${order.number}</td>
      <td align="right"><span style="display:inline-block;background:rgba(255,255,255,0.14);color:#FFFFFF;font-size:11px;font-weight:700;padding:5px 12px;border-radius:999px;text-transform:uppercase;letter-spacing:0.04em;">${statusLabel[order.status] ?? order.status}</span></td>
    </tr></table>
    <div style="color:rgba(255,255,255,0.72);font-size:13px;margin-top:4px;">${escapeHtml(companyName)} · ${date}</div>
  </td></tr>

  <tr><td style="padding:26px 32px 8px;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#F4F5F1;border:1px solid #DEDCD4;border-radius:12px;">
      <tr><td style="padding:16px 20px;">
        <div class="display" style="font-size:16px;font-weight:700;">${escapeHtml(customer.name)}</div>
        <div style="font-size:13px;color:#5B6472;margin-top:6px;line-height:1.7;">${contactLines || '—'}</div>
      </td></tr>
    </table>
  </td></tr>

  <tr><td style="padding:20px 32px 4px;">
    <div style="font-size:11px;letter-spacing:0.08em;text-transform:uppercase;color:#5B6472;font-weight:700;margin-bottom:4px;">Itens do pedido</div>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0">${itemsHtml}</table>
  </td></tr>
  ${notesHtml}
  ${deliveryHtml}
  ${paymentHtml}

  <tr><td style="padding:24px 32px 0;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#FF5A36;border-radius:12px;"><tr>
      <td style="padding:16px 20px;color:#FFFFFF;font-size:13px;font-weight:700;text-transform:uppercase;letter-spacing:0.04em;">Total</td>
      <td align="right" style="padding:16px 20px;color:#FFFFFF;font-size:20px;font-weight:700;font-variant-numeric:tabular-nums;">${formatPrice(order.total)}</td>
    </tr></table>
  </td></tr>

  <tr><td style="padding:20px 32px 28px;text-align:center;">
    <div style="font-size:12px;color:#5B6472;">Gerado automaticamente pelo sistema de pedidos${footerLink}</div>
  </td></tr>

</table>
</td></tr></table>
</body>
</html>`
}

// E-mail para o cliente quando o Mercado Pago confirma o pagamento (webhook).
// Só o essencial — o link de acompanhamento já mostra itens, entrega e
// status detalhados, então o e-mail não duplica isso.
export function buildPaymentConfirmedEmail({
  companyName,
  customerName,
  orderNumber,
  trackingUrl,
}: {
  companyName: string
  customerName: string
  orderNumber: number
  trackingUrl: string
}) {
  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Pagamento confirmado — Pedido #${orderNumber}</title>
<style>
  body { margin:0; padding:0; background:#F4F5F1; font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif; color:#12182A; }
  table { border-collapse:collapse; }
  .display { font-family:Georgia,"Times New Roman",serif; }
</style>
</head>
<body>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:32px 16px;">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#FFFFFF;border-radius:16px;overflow:hidden;border:1px solid #DEDCD4;">

  <tr><td style="background:#16A34A;padding:26px 32px;">
    <div style="font-size:11px;letter-spacing:0.1em;text-transform:uppercase;color:rgba(255,255,255,0.75);font-weight:700;">✅ Pagamento confirmado</div>
    <div class="display" style="color:#FFFFFF;font-size:26px;font-weight:700;margin-top:6px;">Pedido #${orderNumber}</div>
    <div style="color:rgba(255,255,255,0.85);font-size:13px;margin-top:4px;">${escapeHtml(companyName)}</div>
  </td></tr>

  <tr><td style="padding:28px 32px 8px;">
    <div style="font-size:14px;color:#12182A;line-height:1.6;">
      Olá, ${escapeHtml(customerName)}! Recebemos o pagamento do seu pedido #${orderNumber}. A loja já foi avisada e vai preparar o envio.
    </div>
  </td></tr>

  <tr><td style="padding:20px 32px 28px;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#FF5A36;border-radius:12px;"><tr>
      <td align="center" style="padding:16px 20px;">
        <a href="${trackingUrl}" style="color:#FFFFFF;font-size:14px;font-weight:700;text-decoration:none;">Acompanhar meu pedido</a>
      </td>
    </tr></table>
  </td></tr>

  <tr><td style="padding:0 32px 28px;text-align:center;">
    <div style="font-size:12px;color:#5B6472;">Gerado automaticamente pelo sistema de pedidos</div>
  </td></tr>

</table>
</td></tr></table>
</body>
</html>`
}
