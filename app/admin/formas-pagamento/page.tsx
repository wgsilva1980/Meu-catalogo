import { createClient } from '@/lib/supabase/server'
import { resolveActiveCompany } from '@/lib/company'
import type { PaymentMethod } from '@/lib/types'
import { addPaymentMethod, deletePaymentMethod, togglePaymentMethod } from './actions'

export default async function FormasPagamentoPage() {
  const active = await resolveActiveCompany()
  if (!active.ok) return null

  const supabase = await createClient()
  const { data } = await supabase
    .from('payment_methods')
    .select('*')
    .eq('company_id', active.companyId)
    .order('sort_order')
  const methods = (data ?? []) as PaymentMethod[]

  return (
    <div className="flex flex-col gap-5 max-w-2xl">
      <div>
        <h1 className="font-display text-2xl">Formas de pagamento</h1>
        <p className="text-sm text-muted">
          Aparecem para o cliente no link de pedido e na edição do pedido. Formas inativas não são oferecidas em
          novos pedidos, mas continuam nos pedidos antigos.
        </p>
      </div>

      <div className="border border-line rounded-lg overflow-hidden bg-white divide-y divide-line">
        {methods.map((m) => (
          <div key={m.id} className="flex flex-wrap items-center gap-3 p-3 text-sm">
            <span className={`font-semibold flex-1 min-w-0 truncate ${m.active ? '' : 'text-muted line-through'}`}>
              {m.name}
            </span>
            <form action={togglePaymentMethod}>
              <input type="hidden" name="id" value={m.id} />
              <input type="hidden" name="active" value={(!m.active).toString()} />
              <button className="text-xs font-semibold text-muted hover:text-accent">
                {m.active ? 'Desativar' : 'Ativar'}
              </button>
            </form>
            <form action={deletePaymentMethod}>
              <input type="hidden" name="id" value={m.id} />
              <button className="text-xs font-semibold text-red-600">Excluir</button>
            </form>
          </div>
        ))}
        {methods.length === 0 && <p className="p-4 text-sm text-muted">Nenhuma forma de pagamento cadastrada.</p>}
      </div>

      <form action={addPaymentMethod} className="flex gap-2">
        <input name="name" required maxLength={60} placeholder="Nova forma de pagamento" className="input flex-1" />
        <button className="btn btn-primary whitespace-nowrap">
          Adicionar
        </button>
      </form>
    </div>
  )
}
