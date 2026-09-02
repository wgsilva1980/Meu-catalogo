import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { resolveActiveCompany } from '@/lib/company'
import OrderForm from '@/components/OrderForm'
import OrderPdfButton from '@/components/OrderPdfButton'
import ShippingCard from '@/components/ShippingCard'
import DeliveryCard from '@/components/DeliveryCard'

export default async function EditarPedidoPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ erro?: string; faltam?: string }>
}) {
  const active = await resolveActiveCompany()
  if (!active.ok) return null

  const { id } = await params
  const { erro, faltam } = await searchParams
  const supabase = await createClient()

  const { data: order } = await supabase
    .from('sales_orders')
    .select('*')
    .eq('id', id)
    .eq('company_id', active.companyId)
    .single()

  if (!order) notFound()

  const [{ data: items }, { data: customers }, { data: products }, { data: melhorEnvioAccount }, { data: shipment }] = await Promise.all([
    supabase.from('sales_order_items').select('*').eq('order_id', id).eq('company_id', active.companyId),
    supabase.from('customers').select('*').eq('company_id', active.companyId).order('name'),
    supabase.from('products').select('*').eq('company_id', active.companyId).order('name'),
    supabase.from('melhor_envio_accounts').select('company_id').eq('company_id', active.companyId).maybeSingle(),
    supabase.from('shipments').select('*').eq('order_id', id).eq('company_id', active.companyId).maybeSingle(),
  ])

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
      <OrderForm order={order} items={items ?? []} customers={customers ?? []} products={products ?? []} />
      {(order.delivery_method ?? 'a_combinar') === 'melhor_envio' ? (
        <ShippingCard orderId={order.id} connected={!!melhorEnvioAccount} shipment={shipment ?? null} />
      ) : (
        <DeliveryCard
          method={order.delivery_method ?? 'a_combinar'}
          fee={Number(order.delivery_fee ?? 0)}
          address={order.delivery_address ?? null}
          quote={order.delivery_quote ?? null}
        />
      )}
    </div>
  )
}
