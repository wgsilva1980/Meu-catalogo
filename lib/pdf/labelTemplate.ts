import type { Company, Customer, SalesOrder } from '@/lib/types'
import { formatAddress } from '@/lib/format'
import { FRAUNCES_600_FONT_FACE } from '@/lib/pdf/fraunces'

const deliveryLabel: Record<string, string> = {
  retirada: 'Retirar na loja',
  motoboy: 'Motoboy',
  a_combinar: 'A combinar',
  melhor_envio: 'Melhor Envio',
}

// Mesmo motivo do orderTemplate.ts: campos que passam por formulário
// público (nome/telefone do cliente, observações) são renderizados por um
// navegador headless — precisam ser escapados antes de entrar no HTML.
function esc(value: unknown) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

export function buildLabelHtml({
  company,
  customer,
  order,
}: {
  company: Company
  customer: Customer
  order: SalesOrder
}) {
  const date = new Date(order.created_at).toLocaleDateString('pt-BR')
  const method = order.delivery_method ?? 'a_combinar'

  const senderName = company.shipping_origin_name || company.name
  const senderAddress = formatAddress({
    street: company.shipping_origin_street,
    number: company.shipping_origin_number,
    complement: company.shipping_origin_complement,
    neighborhood: company.shipping_origin_neighborhood,
    city: company.shipping_origin_city,
    state: company.shipping_origin_state,
    zip_code: company.shipping_origin_zip_code,
  })

  // Endereço de entrega tem prioridade (pode ter sido preenchido pelo
  // cliente no link público, diferente do cadastro); cai pro endereço
  // cadastrado do cliente se o pedido não tiver um.
  const addr = order.delivery_address
  const recipientAddress = addr
    ? formatAddress(addr)
    : formatAddress({
        street: customer.street,
        number: customer.number,
        complement: customer.complement,
        neighborhood: customer.neighborhood,
        city: customer.city,
        state: customer.state,
        zip_code: customer.zip_code,
      })

  return `<!doctype html>
<html>
<head>
<meta charset="utf-8" />
<style>${labelCss}</style>
</head>
<body>
  <section class="page">
    <header class="head">
      <div class="brand">${esc(senderName)}</div>
      <div class="order-meta">
        <div class="order-num">Pedido #${esc(order.number)}</div>
        <div class="muted">${esc(date)} · ${esc(deliveryLabel[method] ?? method)}</div>
      </div>
    </header>

    <section class="box from">
      <div class="label">Remetente</div>
      <div class="name">${esc(senderName)}</div>
      ${company.shipping_origin_document ? `<div class="line">${esc(company.shipping_origin_document)}</div>` : ''}
      ${senderAddress ? `<div class="line">${esc(senderAddress)}</div>` : ''}
      ${company.phone ? `<div class="line">${esc(company.phone)}</div>` : ''}
    </section>

    <section class="box to">
      <div class="label">Destinatário</div>
      <div class="name">${esc(customer.name)}</div>
      ${recipientAddress ? `<div class="addr">${esc(recipientAddress)}</div>` : ''}
      ${customer.phone ? `<div class="line">${esc(customer.phone)}</div>` : ''}
    </section>

    ${order.notes ? `<section class="notes"><div class="label">Observações</div><p>${esc(order.notes)}</p></section>` : ''}
  </section>
</body>
</html>`
}

// Página A6 (105 x 148mm) = 1/4 de uma folha A4, o formato de fato passado
// pro puppeteer (renderHtmlToPdf com format: 'a6') — não é só um box pequeno
// dentro de uma A4, a página do PDF já sai nesse tamanho.
const labelCss = `
  ${FRAUNCES_600_FONT_FACE}
  * { box-sizing: border-box; }
  body { margin: 0; font-family: -apple-system, Helvetica, Arial, sans-serif; color: #12182A; }
  .page { width: 105mm; min-height: 148mm; padding: 6mm; display: flex; flex-direction: column; gap: 6px; }
  .head { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 1.5px solid #12182A; padding-bottom: 6px; }
  .brand { font-family: 'Fraunces', Georgia, 'Times New Roman', serif; font-size: 13px; font-weight: 600; }
  .muted { color: #5B6472; font-size: 8px; margin-top: 2px; }
  .order-meta { text-align: right; }
  .order-num { font-size: 10px; font-weight: 700; }
  .label { font-size: 7px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.06em; color: #5B6472; }
  .box { border: 1px solid #E4E1D9; border-radius: 6px; padding: 6px 8px; }
  .box.from { margin-top: 2px; }
  .box.from .name { font-size: 9px; font-weight: 700; margin-top: 2px; }
  .box.to { border: 1.5px solid #12182A; padding: 8px 9px; margin-top: 2px; flex: 1; }
  .box.to .name { font-size: 13px; font-weight: 700; margin-top: 4px; }
  .box.to .addr { font-size: 9px; margin-top: 4px; line-height: 1.4; }
  .line { font-size: 8px; margin-top: 2px; }
  .box.to .line { font-size: 9px; margin-top: 4px; }
  .notes { border-top: 1px solid #E4E1D9; padding-top: 6px; }
  .notes p { font-size: 8px; white-space: pre-wrap; margin: 2px 0 0; }
`
