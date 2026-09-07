import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { createAdminClient } from '@/lib/supabase/admin'
import { getShipmentTracking } from '@/lib/melhorEnvio'
import { orderDiscountAmount } from '@/lib/orderTotals'
import TrackingTimeline from '@/components/TrackingTimeline'
import PaymentBrick from '@/components/PaymentBrick'
import StoreHeader from '@/components/StoreHeader'
import StoreFooter from '@/components/StoreFooter'
import Card from '@/components/Card'
import Badge from '@/components/Badge'
import Alert from '@/components/Alert'
import { describeMercadoPagoPaymentMethod } from '@/lib/mercadoPago'
import { toMercadoPagoIdentification } from '@/lib/cpfCnpj'
import { formatPrice, UUID_RE } from '@/lib/format'
import type { DeliveryMethod, DiscountType } from '@/lib/types'
import { ClockIcon, CheckIcon, XIcon } from '@/components/icons'
import type { BadgeVariant } from '@/components/Badge'

export const runtime = 'nodejs'
// Cache leve por link: evita bater na API do Melhor Envio a cada refresh do
// cliente. O botão "Atualizar" busca o rastreio fresco pela rota de API.
export const revalidate = 60

// Cor sozinha não é sinal suficiente (daltonismo, leitor de tela) — cada
// status do pedido ganha um ícone próprio ao lado do texto.
const STATUS_LABEL: Record<string, { label: string; variant: BadgeVariant; Icon: typeof ClockIcon }> = {
  rascunho: { label: 'Aguardando confirmação', variant: 'warning', Icon: ClockIcon },
  confirmado: { label: 'Confirmado', variant: 'success', Icon: CheckIcon },
  cancelado: { label: 'Cancelado', variant: 'danger', Icon: XIcon },
}

const DELIVERY_LABEL: Record<DeliveryMethod, string> = {
  retirada: 'Retirada na loja',
  motoboy: 'Entrega por motoboy',
  a_combinar: 'Entrega a combinar',
  melhor_envio: 'Envio por transportadora',
}

// Sem isso, o link de acompanhamento (que o cliente às vezes repassa, ex.:
// pra combinar a entrega com outra pessoa) gerava uma prévia sem nome nem
// logo da loja — ver "Raio-X do Catálogo", achado P2.
export async function generateMetadata({ params }: { params: Promise<{ token: string }> }): Promise<Metadata> {
  const { token } = await params
  if (!UUID_RE.test(token)) return {}

  const supabase = createAdminClient()
  const { data: order } = await supabase
    .from('sales_orders')
    .select('company_id')
    .eq('public_token', token)
    .maybeSingle()
  if (!order) return {}

  const { data: company } = await supabase
    .from('companies')
    .select('name, logo_url')
    .eq('id', order.company_id)
    .single()
  if (!company) return {}

  const title = `Acompanhar pedido — ${company.name}`
  const description = `Status do pedido e do pagamento em ${company.name}.`
  return {
    title,
    description,
    openGraph: { title, description, images: company.logo_url ? [company.logo_url] : undefined },
    twitter: { card: 'summary', title, description, images: company.logo_url ? [company.logo_url] : undefined },
  }
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
    supabase.from('companies').select('name, logo_url, phone, email, instagram, website').eq('id', order.company_id).single(),
    supabase.from('sales_order_items').select('product_name, quantity, unit_price, subtotal').eq('order_id', order.id),
    supabase
      .from('shipments')
      .select('melhor_envio_id, tracking_code, service_name')
      .eq('order_id', order.id)
      .maybeSingle(),
    order.payment_method_id
      ? supabase.from('payment_methods').select('name').eq('id', order.payment_method_id).maybeSingle()
      : Promise.resolve({ data: null }),
    supabase.from('payments').select('status, mp_payment_id, raw').eq('order_id', order.id).maybeSingle(),
    supabase.from('mercado_pago_accounts').select('public_key, min_installment_amount').eq('company_id', order.company_id).maybeSingle(),
    supabase.from('customers').select('name, email, document').eq('id', order.customer_id).maybeSingle(),
  ])

  // Quando existe um pagamento online de verdade, o que o cliente escolheu
  // no Payment Brick (Pix/cartão) manda mais do que a forma "combinada" na
  // hora do pedido — senão o resumo fica preso no que foi escolhido antes de
  // saber que ia pagar online (ex.: mostrar "Transferência" pra um Pix).
  const rawPayment = payment?.raw as { payment_type_id?: string; payment_method_id?: string } | null | undefined
  const onlinePaymentLabel = rawPayment
    ? describeMercadoPagoPaymentMethod({
        payment_type_id: rawPayment.payment_type_id ?? null,
        payment_method_id: rawPayment.payment_method_id ?? null,
      })
    : null
  const paymentMethodLabel = onlinePaymentLabel ?? paymentMethod?.name ?? null

  // Parcelas oferecidas no cartão = quantas cabem no valor mínimo que a
  // loja configurou (Configurações > Mercado Pago), não um teto fixo igual
  // pra qualquer pedido — um pedido de R$60 não deveria oferecer 6x de R$10.
  const minInstallmentAmount = Number(mpAccount?.min_installment_amount ?? 50) || 50
  const maxInstallments = Math.max(1, Math.min(12, Math.floor(Number(order.total) / minInstallmentAmount)))

  const itemsSubtotal = (items ?? []).reduce((sum, i) => sum + Number(i.subtotal), 0)
  const discount = orderDiscountAmount(
    itemsSubtotal,
    (order.discount_type as DiscountType | null) ?? null,
    Number(order.discount_value ?? 0)
  )
  const deliveryFee = Number(order.delivery_fee ?? 0)
  const deliveryMethod = (order.delivery_method ?? 'a_combinar') as DeliveryMethod
  const status = STATUS_LABEL[order.status] ?? { label: order.status, variant: 'neutral' as const, Icon: ClockIcon }
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
    <>
      {company && <StoreHeader company={company} />}
      <main className="min-h-screen flex flex-col items-center px-4 py-10 gap-8 bg-paper">
        <Card className="w-full max-w-xl flex flex-col gap-5">
          <div className="flex flex-col items-center gap-2 text-center">
            <h1 className="font-display text-title">Acompanhamento do pedido</h1>
          </div>

        {novo === '1' && (
          <Alert variant="success" center>
            Pedido enviado com sucesso! Confira os detalhes abaixo.
          </Alert>
        )}

        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line pb-4">
          <div>
            <div className="font-display text-lg">Pedido #{order.number}</div>
            <div className="text-xs text-muted">{date}</div>
          </div>
          <Badge variant={status.variant}>
            <status.Icon className="w-3.5 h-3.5" />
            {status.label}
          </Badge>
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
          {paymentMethodLabel && <div className="text-muted">Forma de pagamento: {paymentMethodLabel}</div>}
        </section>

        {Number(order.total) > 0 && (Boolean(order.paid_at) || Boolean(mpAccount?.public_key) || Boolean(payment)) && (
          <Card as="section" tight className="flex flex-col gap-2">
            <h2 className="text-sm font-bold">Pagamento</h2>
            {order.paid_at ? (
              <p className="text-sm text-success font-semibold">
                Pagamento confirmado em {new Date(order.paid_at).toLocaleDateString('pt-BR')}.
              </p>
            ) : mpAccount?.public_key ? (
              // Moldura própria (não só o card-tight genérico da seção) —
              // é literalmente onde o cartão é digitado, merece se destacar
              // do resto da tela em vez de se misturar com qualquer outro
              // bloco de texto.
              <div className="border-2 border-accent/20 rounded-xl p-3 flex flex-col gap-2">
                <p className="text-sm text-muted">Total a pagar: {formatPrice(Number(order.total))}</p>
                <PaymentBrick
                  token={token}
                  publicKey={mpAccount.public_key}
                  amount={Number(order.total)}
                  maxInstallments={maxInstallments}
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
              </div>
            ) : (
              <p className="text-sm text-muted">Combine o pagamento diretamente com a loja.</p>
            )}
          </Card>
        )}

        {(shipment?.melhor_envio_id || tracking.code) && (
          <Card as="section" tight className="flex flex-col gap-2">
            <h2 className="text-sm font-bold">Rastreio da entrega</h2>
            <TrackingTimeline initial={tracking} refreshUrl={`/api/acompanhar/${token}/rastreio`} />
          </Card>
        )}

        </Card>
        {company && <StoreFooter company={company} />}
      </main>
    </>
  )
}
