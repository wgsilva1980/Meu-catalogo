import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { resolveActiveCompany } from '@/lib/company'
import OrderForm from '@/components/OrderForm'
import OrderPdfButton from '@/components/OrderPdfButton'

export default async function EditarPedidoPage({ params }: { params: Promise<{ id: string }> }) {
  const active = await resolveActiveCompany()
  if (!active.ok) return null

  const { id } = await params
  const supabase = await createClient()

  const { data: order } = await supabase
    .from('sales_orders')
    .select('*')
    .eq('id', id)
    .eq('company_id', active.companyId)
    .single()

  if (!order) notFound()

  const [{ data: items }, { data: customers }, { data: products }] = await Promise.all([
    supabase.from('sales_order_items').select('*').eq('order_id', id).eq('company_id', active.companyId),
    supabase.from('customers').select('*').eq('company_id', active.companyId).order('name'),
    supabase.from('products').select('*').eq('company_id', active.companyId).order('name'),
  ])

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl">Pedido #{order.number}</h1>
          <p className="text-sm text-muted">Editar pedido</p>
        </div>
        <OrderPdfButton orderId={order.id} />
      </div>
      <OrderForm order={order} items={items ?? []} customers={customers ?? []} products={products ?? []} />
    </div>
  )
}
