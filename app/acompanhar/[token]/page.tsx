import { notFound } from 'next/navigation'
import { createAdminClient } from '@/lib/supabase/admin'
import { getShipmentTracking } from '@/lib/melhorEnvio'
import { orderDiscountAmount } from '@/lib/orderTotals'
import TrackingTimeline from '@/components/TrackingTimeline'
import PaymentBrick from '@/components/PaymentBrick'
import { toMercadoPagoIdentification } from '@/lib/cpfCnpj'
import type { DeliveryMethod, DiscountType } from '@/lib/types'

export const runtime = 'nodejs'
// Cache leve por link: evita bater na API do Melhor Envio a cada refresh do
// cliente. O botão "Atualizar" busca o rastreio fresco pela rota de API.
export const revalidate = 60

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

const STATUS_LABEL: Record<string, { label: string; cls: string }> = {
  rascunho: { label: 'Aguardando confirmação', cls: 'bg-amber-100 text-amber-700' },
  confirmado: { label: 'Confirmado', cls: 'bg-green-100 text-green-700' },
  cancelado: { label: 'Cancelado', cls: 'bg-red-100 text-red-700' },
}

const DELIVERY_LABEL: Record<DeliveryMethod, string> = {
  retirada: 'Retirada na loja',
  motoboy: 'Entrega por motoboy',
  a_combinar: 'Entrega a combinar',
  melhor_envio: 'Envio por transportadora',
}

function formatPrice(value: number) {
  return `R$ ${Number(value).toFixed(2).replace('.', ',')}`
}

export default async function AcompanharPedidoPage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>
  searchParams: Promise<{ novo?: string }>
}) {
  const { token } = await params
  const { novo } = await searchParams
  if (!UUID_RE.test(token)) notFound()

  const supabase = createAdminClient()
  const { data: order } = await supabase
    .from('sales_orders')
    .select('*')
    .eq('public_token', token)
    .maybeSingle()
  if (!order) notFound()

  const [
    { data: company },
    { data: items },
    { data: shipment },
    { data: paymentMethod },
    { data: payment },
    { data: mpAccount },
    { data: customer },
  ] = await Promise.all([
    supabase.from('companies').select('name, logo_url').eq('id', order.company_id).single(),
    supabase.from('sales_order_items').select('product_name, quantity, unit_price, subtotal').eq('order_id', order.id),
    supabase
      .from('shipments')
      .select('melhor_envio_id, tracking_code, service_name')
      .eq('order_id', order.id)
      .maybeSingle(),
    order.payment_method_id
      ? supabase.from('payment_methods').select('name').eq('id', order.payment_method_id).maybeSingle()
      : Promise.resolve({ data: null }),
    supabase.from('payments').select('status, mp_payment_id').eq('order_id', order.id).maybeSingle(),
    supabase.from('mercado_pago_accounts').select('public_key').eq('company_id', order.company_id).maybeSingle(),
    supabase.from('customers').select('name, email, document').eq('id', order.customer_id).maybeSingle(),
  ])

  const itemsSubtotal = (items ?? []).reduce((sum, i) => sum + Number(i.subtotal), 0)
  const discount = orderDiscountAmount(
    itemsSubtotal,
    (order.discount_type as DiscountType | null) ?? null,
    Number(order.discount_value ?? 0)
  )
  const deliveryFee = Number(order.delivery_fee ?? 0)
  const deliveryMethod = (order.delivery_method ?? 'a_combinar') as DeliveryMethod
  const status = STATUS_LABEL[order.status] ?? { label: order.status, cls: 'bg-black/5 text-muted' }
  const date = new Date(order.created_at).toLocaleDateString('pt-BR')

  let tracking: { code: string | null; status: string | null; events: { date: string | null; description: string | null; location: string | null }[] } = {
    code: shipment?.tracking_code ?? null,
    status: null,
    events: [],
  }
  if (shipment?.melhor_envio_id) {
    try {
      tracking = await getShipmentTracking({ companyId: order.company_id, melhorEnvioId: shipment.melhor_envio_id })
    } catch {
      // mantém o fallback com o código já salvo
    }
  }

  return (
    <main className="min-h-screen flex items-start justify-center px-4 py-10 bg-paper">
      <div className="w-full max-w-xl bg-white border border-line rounded-2xl p-6 flex flex-col gap-5">
        <div className="flex flex-col items-center gap-2 text-center">
          {company?.logo_url && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={company.logo_url} alt={company?.name ?? ''} className="h-12 object-contain" />
          )}
          <h1 className="font-display text-xl">{company?.name}</h1>
        </div>

        {novo === '1' && (
          <p className="text-sm text-green-700 bg-green-50 border border-green-200 rounded-lg p-4 text-center">
            Pedido enviado com sucesso! Confira os detalhes abaixo.
          </p>
        )}

        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line pb-4">
          <div>
            <div className="font-display text-lg">Pedido #{order.number}</div>
            <div className="text-xs text-muted">{date}</div>
          </div>
          <span className={`text-xs font-bold px-3 py-1 rounded-full ${status.cls}`}>{status.label}</span>
        </div>

        <section className="flex flex-col gap-2">
          <h2 className="text-sm font-bold">Itens</h2>
          <div className="flex flex-col gap-1 text-sm">
            {(items ?? []).map((it, i) => (
              <div key={i} className="flex justify-between gap-3">
                <span className="min-w-0 truncate">
                  {it.quantity}× {it.product_name}
                </span>
                <span className="tabular-nums whitespace-nowrap">{formatPrice(Number(it.subtotal))}</span>
              </div>
            ))}
          </div>
          <div className="flex flex-col gap-1 border-t border-line pt-2 text-sm">
            {(discount > 0 || deliveryFee > 0) && (
              <div className="flex justify-between text-muted">
                <span>Subtotal</span>
                <span>{formatPrice(itemsSubtotal)}</span>
              </div>
            )}
            {discount > 0 && (
              <div className="flex justify-between text-muted">
                <span>Desconto</span>
                <span>- {formatPrice(discount)}</span>
              </div>
            )}
            {deliveryFee > 0 && (
              <div className="flex justify-between text-muted">
                <span>Entrega</span>
                <span>{formatPrice(deliveryFee)}</span>
              </div>
            )}
            <div className="flex justify-between font-bold">
              <span>Total</span>
              <span>{formatPrice(Number(order.total))}</span>
            </div>
          </div>
        </section>

        <section className="flex flex-col gap-1 text-sm">
          <h2 className="text-sm font-bold">Entrega e pagamento</h2>
          <div className="text-muted">Entrega: {DELIVERY_LABEL[deliveryMethod] ?? deliveryMethod}</div>
          {paymentMethod?.name && <div className="text-muted">Forma de pagamento: {paymentMethod.name}</div>}
        </section>

        {Number(order.total) > 0 && (Boolean(order.paid_at) || Boolean(mpAccount?.public_key) || Boolean(payment)) && (
          <section className="flex flex-col gap-2 border border-line rounded-xl p-4">
            <h2 className="text-sm font-bold">Pagamento</h2>
            {order.paid_at ? (
              <p className="text-sm text-green-700 font-semibold">
                Pagamento confirmado em {new Date(order.paid_at).toLocaleDateString('pt-BR')}.
              </p>
            ) : mpAccount?.public_key ? (
              <>
                <p className="text-sm text-muted">Total a pagar: {formatPrice(Number(order.total))}</p>
                <PaymentBrick
                  token={token}
                  publicKey={mpAccount.public_key}
                  amount={Number(order.total)}
                  // Pix pendente sobrevive a fechar a aba — sem isso, reabrir
                  // o link mostra o formulário do zero de novo, e dá pra
                  // acabar gerando (e pagando) um segundo Pix pro mesmo pedido.
                  pendingPayment={
                    payment?.status === 'pending' && payment.mp_payment_id
                      ? { paymentId: payment.mp_payment_id }
                      : null
                  }
                  payer={{
                    email: customer?.email ?? null,
                    firstName: customer?.name?.split(' ')[0] ?? null,
                    identification: toMercadoPagoIdentification(customer?.document),
                  }}
                />
              </>
            ) : (
              <p className="text-sm text-muted">Combine o pagamento diretamente com a loja.</p>
            )}
          </section>
        )}

        {(shipment?.melhor_envio_id || tracking.code) && (
          <section className="flex flex-col gap-2 border border-line rounded-xl p-4">
            <h2 className="text-sm font-bold">Rastreio da entrega</h2>
            <TrackingTimeline initial={tracking} refreshUrl={`/api/acompanhar/${token}/rastreio`} />
          </section>
        )}

        <p className="text-center text-xs text-muted">Acompanhamento do pedido — {company?.name}</p>
      </div>
    </main>
  )
}
