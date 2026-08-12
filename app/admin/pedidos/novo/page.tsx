import { createClient } from '@/lib/supabase/server'
import { resolveActiveCompany } from '@/lib/company'
import OrderForm from '@/components/OrderForm'

export default async function NovoPedidoPage() {
  const active = await resolveActiveCompany()
  if (!active.ok) return null

  const supabase = await createClient()
  const [{ data: customers }, { data: products }] = await Promise.all([
    supabase.from('customers').select('*').eq('company_id', active.companyId).order('name'),
    supabase.from('products').select('*').eq('company_id', active.companyId).eq('available', true).order('name'),
  ])

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-display text-2xl">Novo pedido</h1>
        <p className="text-sm text-muted">Registrar venda para um cliente</p>
      </div>
      <OrderForm customers={customers ?? []} products={products ?? []} />
    </div>
  )
}
