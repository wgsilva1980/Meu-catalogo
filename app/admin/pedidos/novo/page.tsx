import { createClient } from '@/lib/supabase/server'
import { resolveActiveCompany } from '@/lib/company'
import OrderForm from '@/components/OrderForm'

export default async function NovoPedidoPage({
  searchParams,
}: {
  searchParams: Promise<{ erro?: string; faltam?: string }>
}) {
  const active = await resolveActiveCompany()
  if (!active.ok) return null

  const { erro, faltam } = await searchParams
  const supabase = await createClient()
  const [{ data: customers }, { data: products }, { data: paymentMethods }] = await Promise.all([
    supabase.from('customers').select('*').eq('company_id', active.companyId).order('name'),
    supabase.from('products').select('*').eq('company_id', active.companyId).eq('available', true).order('name'),
    supabase.from('payment_methods').select('*').eq('company_id', active.companyId).order('sort_order'),
  ])

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-display text-2xl">Novo pedido</h1>
        <p className="text-sm text-muted">Registrar venda para um cliente</p>
      </div>
      {erro === 'estoque' && (
        <p className="rounded-lg border border-red-200 bg-red-50 text-red-700 text-sm px-3 py-2">
          Estoque insuficiente{faltam ? ` para: ${faltam}` : ''}. Salve como rascunho ou dê entrada no estoque antes de confirmar.
        </p>
      )}
      <OrderForm customers={customers ?? []} products={products ?? []} paymentMethods={paymentMethods ?? []} />
    </div>
  )
}
