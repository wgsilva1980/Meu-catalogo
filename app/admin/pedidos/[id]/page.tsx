import { headers } from 'next/headers'
import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { resolveActiveCompany } from '@/lib/company'
import OrderForm from '@/components/OrderForm'
import OrderPdfButton from '@/components/OrderPdfButton'
import DeliveryCard from '@/components/DeliveryCard'
import CopyLinkField from '@/components/CopyLinkField'
import { CheckIcon, AlertIcon, XIcon } from '@/components/icons'
import Badge from '@/components/Badge'
import Alert from '@/components/Alert'
import Card from '@/components/Card'

export default async function EditarPedidoPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ erro?: string; faltam?: string; salvo?: string }>
}) {
  const active = await resolveActiveCompany()
  if (!active.ok) return null

  const { id } = await params
  const { erro, faltam, salvo } = await searchParams
  const supabase = await createClient()

  const { data: order } = await supabase
    .from('sales_orders')
    .select('*')
    .eq('id', id)
    .eq('company_id', active.companyId)
    .single()

  if (!order) notFound()

  const [{ data: items }, { data: customers }, { data: products }, { data: melhorEnvioAccount }, { data: shipment }, { data: paymentMethods }, { data: payment }] =
    await Promise.all([
      supabase.from('sales_order_items').select('*').eq('order_id', id).eq('company_id', active.companyId),
      supabase.from('customers').select('*').eq('company_id', active.companyId).order('name'),
      supabase.from('products').select('*').eq('company_id', active.companyId).order('name'),
      supabase.from('melhor_envio_accounts').select('company_id').eq('company_id', active.companyId).maybeSingle(),
      supabase.from('shipments').select('*').eq('order_id', id).eq('company_id', active.companyId).maybeSingle(),
      supabase.from('payment_methods').select('*').eq('company_id', active.companyId).order('sort_order'),
      supabase.from('payments').select('status').eq('order_id', id).maybeSingle(),
    ])

  const host = (await headers()).get('host')
  const protocol = host?.startsWith('localhost') ? 'http' : 'https'
  const trackingUrl = order.public_token && host ? `${protocol}://${host}/acompanhar/${order.public_token}` : null

  return (
    <div className="flex flex-col gap-6 max-w-2xl">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="font-display text-2xl">Pedido #{order.number}</h1>
            {order.paid_at && (
              <Badge variant="success" size="sm">
                <CheckIcon className="w-3 h-3" />
                Pago
              </Badge>
            )}
            {order.status === 'confirmado' && order.paid_at && !order.stock_committed && (
              <Badge
                variant="warning"
                size="sm"
                title="O pagamento foi aprovado mas o estoque não pôde ser baixado automaticamente — provavelmente faltou saldo na hora. Dê entrada no estoque e confirme o pedido de novo."
              >
                <AlertIcon className="w-3 h-3" />
                Revisar estoque
              </Badge>
            )}
            {(payment?.status === 'refunded' || payment?.status === 'cancelled') && (
              <Badge variant="danger" size="sm">
                <XIcon className="w-3 h-3" />
                {payment.status === 'refunded' ? 'Estornado' : 'Pagamento cancelado'}
              </Badge>
            )}
          </div>
          <p className="text-sm text-muted">Editar pedido</p>
        </div>
        <OrderPdfButton orderId={order.id} />
      </div>
      {erro === 'estoque' && (
        <Alert variant="danger">
          Estoque insuficiente{faltam ? ` para: ${faltam}` : ''}. Dê entrada no estoque ou reduza a quantidade antes de
          confirmar.
        </Alert>
      )}
      {salvo === '1' && !erro && <Alert variant="success">Pedido salvo.</Alert>}
      <OrderForm
        order={order}
        items={items ?? []}
        customers={customers ?? []}
        products={products ?? []}
        melhorEnvioConnected={!!melhorEnvioAccount}
        shipment={shipment ?? null}
        paymentMethods={paymentMethods ?? []}
      />
      {(order.delivery_method ?? 'a_combinar') !== 'melhor_envio' && (
        <DeliveryCard
          method={order.delivery_method ?? 'a_combinar'}
          fee={Number(order.delivery_fee ?? 0)}
          address={order.delivery_address ?? null}
          quote={order.delivery_quote ?? null}
        />
      )}
      {trackingUrl && (
        <Card as="section" tight className="flex flex-col gap-2">
          <h2 className="text-sm font-bold">Link de acompanhamento do cliente</h2>
          <p className="text-xs text-muted">
            Envie para o cliente acompanhar o status do pedido e o rastreio da entrega, sem login.
          </p>
          <CopyLinkField url={trackingUrl} />
        </Card>
      )}
    </div>
  )
}
