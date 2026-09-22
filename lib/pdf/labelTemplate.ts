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
    <section class="quadrant">
      <header class="head">
        <div class="brand">${esc(senderName)}</div>
        <div class="order-meta">
          <div class="order-num">Pedido #${esc(order.number)}</div>
          <div class="muted">${esc(date)} · ${esc(deliveryLabel[method] ?? method)}</div>
        </div>
      </header>

      <section class="boxes">
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
      </section>
    </section>
  </section>
</body>
</html>`
}

// A folha do PDF continua A4 (papel comum de impressora). O quadrante da
// etiqueta ocupa a largura toda e altura de 74,25mm — exatamente 1/4 da
// altura de uma A4 (297mm) — com remetente e destinatário lado a lado
// dentro dele, e borda tracejada pra recortar.
const labelCss = `
  ${FRAUNCES_600_FONT_FACE}
  * { box-sizing: border-box; }
  body { margin: 0; font-family: -apple-system, Helvetica, Arial, sans-serif; color: #12182A; }
  .page { width: 210mm; min-height: 297mm; padding: 10mm; }
  .quadrant { width: 100%; height: 74.25mm; padding: 5mm 6mm; display: flex; flex-direction: column; gap: 5px; border: 1px dashed #B8B2A3; overflow: hidden; }
  .head { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 1.5px solid #12182A; padding-bottom: 5px; }
  .brand { font-family: 'Fraunces', Georgia, 'Times New Roman', serif; font-size: 13px; font-weight: 600; }
  .muted { color: #5B6472; font-size: 8px; margin-top: 2px; }
  .order-meta { text-align: right; }
  .order-num { font-size: 10px; font-weight: 700; }
  .label { font-size: 7px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.06em; color: #5B6472; }
  .boxes { display: flex; flex-direction: row; gap: 8px; flex: 1; min-height: 0; }
  .box { flex: 1; min-width: 0; border: 1px solid #E4E1D9; border-radius: 6px; padding: 6px 8px; overflow: hidden; }
  .box.from .name { font-size: 9px; font-weight: 700; margin-top: 2px; }
  .box.to { border: 1.5px solid #12182A; padding: 8px 9px; }
  .box.to .name { font-size: 12px; font-weight: 700; margin-top: 4px; }
  .box.to .addr { font-size: 8.5px; margin-top: 4px; line-height: 1.35; }
  .line { font-size: 8px; margin-top: 2px; }
  .box.to .line { font-size: 8.5px; margin-top: 4px; }
`
