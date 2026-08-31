import type { Company, Customer, SalesOrder, SalesOrderItem } from '@/lib/types'

const statusLabel: Record<string, string> = {
  rascunho: 'Rascunho',
  confirmado: 'Confirmado',
  cancelado: 'Cancelado',
}

function formatPrice(value: number) {
  return `R$ ${Number(value).toFixed(2).replace('.', ',')}`
}

// Parte destes campos (nome/telefone/e-mail do cliente, observações) vem de
// formulários públicos sem autenticação e é renderizada por um navegador
// headless ao gerar o PDF — precisa ser escapada para não injetar HTML/script.
function esc(value: unknown) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

export function buildOrderHtml({
  company,
  customer,
  order,
  items,
}: {
  company: Company
  customer: Customer
  order: SalesOrder
  items: SalesOrderItem[]
}) {
  const date = new Date(order.created_at).toLocaleDateString('pt-BR')

  return `<!doctype html>
<html>
<head>
<meta charset="utf-8" />
<style>${orderCss}</style>
</head>
<body>
  <section class="page">
    <header class="head">
      <div>
        <div class="brand">${esc(company.name)}</div>
        ${company.phone ? `<div class="muted">${esc(company.phone)}</div>` : ''}
      </div>
      <div class="order-meta">
        <div class="order-num">Pedido #${esc(order.number)}</div>
        <div class="muted">${esc(date)}</div>
        <div class="status">${esc(statusLabel[order.status] ?? order.status)}</div>
      </div>
    </header>

    <section class="customer">
      <div class="label">Cliente</div>
      <div class="cust-name">${esc(customer.name)}</div>
      <div class="muted">${[customer.phone, customer.email].filter(Boolean).map(esc).join(' · ')}</div>
    </section>

    <table class="items">
      <thead>
        <tr>
          <th>Produto</th>
          <th class="num">Qtd</th>
          <th class="num">Preço unit.</th>
          <th class="num">Subtotal</th>
        </tr>
      </thead>
      <tbody>
        ${items
          .map(
            (item) => `
        <tr>
          <td>${esc(item.product_name)}</td>
          <td class="num">${esc(item.quantity)}</td>
          <td class="num">${formatPrice(item.unit_price)}</td>
          <td class="num">${formatPrice(item.subtotal)}</td>
        </tr>`
          )
          .join('')}
      </tbody>
      <tfoot>
        <tr>
          <td colspan="3" class="num total-label">Total</td>
          <td class="num total-value">${formatPrice(order.total)}</td>
        </tr>
      </tfoot>
    </table>

    ${order.notes ? `<section class="notes"><div class="label">Observações</div><p>${esc(order.notes)}</p></section>` : ''}
  </section>
</body>
</html>`
}

const orderCss = `
  * { box-sizing: border-box; }
  body { margin: 0; font-family: -apple-system, Helvetica, Arial, sans-serif; color: #12182A; }
  .page { width: 210mm; min-height: 297mm; padding: 20mm 18mm; display: flex; flex-direction: column; gap: 16px; }
  .head { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid #12182A; padding-bottom: 12px; }
  .brand { font-family: Georgia, serif; font-size: 22px; font-weight: 700; }
  .muted { color: #5B6472; font-size: 12px; margin-top: 2px; }
  .order-meta { text-align: right; }
  .order-num { font-size: 16px; font-weight: 700; }
  .status { display: inline-block; margin-top: 4px; font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.04em; background: rgba(255,90,54,0.12); color: #FF5A36; padding: 2px 8px; border-radius: 5px; }
  .label { font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.06em; color: #5B6472; }
  .cust-name { font-size: 15px; font-weight: 700; margin-top: 2px; }
  .items { width: 100%; border-collapse: collapse; margin-top: 8px; font-size: 12px; }
  .items th { text-align: left; font-size: 10px; text-transform: uppercase; letter-spacing: 0.04em; color: #5B6472; border-bottom: 2px solid #12182A; padding: 6px 4px; }
  .items td { padding: 8px 4px; border-bottom: 1px solid #E4E1D9; }
  .items .num { text-align: right; }
  .total-label { font-weight: 700; padding-top: 12px; border-bottom: none; }
  .total-value { font-weight: 700; font-size: 15px; padding-top: 12px; border-bottom: none; }
  .notes { border-top: 1px solid #E4E1D9; padding-top: 12px; }
  .notes p { font-size: 12px; white-space: pre-wrap; margin: 4px 0 0; }
`
