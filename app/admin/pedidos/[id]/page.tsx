import { headers } from 'next/headers'
import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { resolveActiveCompany } from '@/lib/company'
import OrderForm from '@/components/OrderForm'
import OrderPdfButton from '@/components/OrderPdfButton'
import DeliveryCard from '@/components/DeliveryCard'
import CopyLinkField from '@/components/CopyLinkField'

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

  const [{ data: items }, { data: customers }, { data: products }, { data: melhorEnvioAccount }, { data: shipment }, { data: paymentMethods }] =
    await Promise.all([
      supabase.from('sales_order_items').select('*').eq('order_id', id).eq('company_id', active.companyId),
      supabase.from('customers').select('*').eq('company_id', active.companyId).order('name'),
      supabase.from('products').select('*').eq('company_id', active.companyId).order('name'),
      supabase.from('melhor_envio_accounts').select('company_id').eq('company_id', active.companyId).maybeSingle(),
      supabase.from('shipments').select('*').eq('order_id', id).eq('company_id', active.companyId).maybeSingle(),
      supabase.from('payment_methods').select('*').eq('company_id', active.companyId).order('sort_order'),
    ])

  const host = (await headers()).get('host')
  const protocol = host?.startsWith('localhost') ? 'http' : 'https'
  const trackingUrl = order.public_token && host ? `${protocol}://${host}/acompanhar/${order.public_token}` : null

  return (
    <div className="flex flex-col gap-6 max-w-2xl">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl">Pedido #{order.number}</h1>
          <p className="text-sm text-muted">Editar pedido</p>
        </div>
        <OrderPdfButton orderId={order.id} />
      </div>
      {erro === 'estoque' && (
        <p className="rounded-lg border border-red-200 bg-red-50 text-red-700 text-sm px-3 py-2">
          Estoque insuficiente{faltam ? ` para: ${faltam}` : ''}. Dê entrada no estoque ou reduza a quantidade antes de confirmar.
        </p>
      )}
      {salvo === '1' && !erro && (
        <p className="rounded-lg border border-green-200 bg-green-50 text-green-700 text-sm px-3 py-2">
          Pedido salvo.
        </p>
      )}
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
        <section className="flex flex-col gap-2 border border-line rounded-xl p-4">
          <h2 className="text-sm font-bold">Link de acompanhamento do cliente</h2>
          <p className="text-xs text-muted">
            Envie para o cliente acompanhar o status do pedido e o rastreio da entrega, sem login.
          </p>
          <CopyLinkField url={trackingUrl} />
        </section>
      )}
    </div>
  )
}
