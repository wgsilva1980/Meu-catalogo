import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { resolveActiveCompany } from '@/lib/company'
import { deleteOrder, updateOrderStatus } from './actions'
import { PencilIcon, TrashIcon } from '@/components/icons'
import type { OrderStatus } from '@/lib/types'

const statusLabel: Record<OrderStatus, string> = {
  rascunho: 'Rascunho',
  confirmado: 'Confirmado',
  cancelado: 'Cancelado',
}

const statusClass: Record<OrderStatus, string> = {
  rascunho: 'bg-black/5 text-muted',
  confirmado: 'bg-green-100 text-green-700',
  cancelado: 'bg-red-100 text-red-700',
}

export default async function PedidosPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string }>
}) {
  const active = await resolveActiveCompany()
  if (!active.ok) return null

  const { q, status } = await searchParams
  const supabase = await createClient()

  let query = supabase
    .from('sales_orders')
    .select('*, customers(name)')
    .eq('company_id', active.companyId)
    .order('created_at', { ascending: false })
  if (status) query = query.eq('status', status)
  const { data: orders } = await query

  const filtered = q
    ? (orders ?? []).filter((o: any) => (o.customers?.name ?? '').toLowerCase().includes(q.toLowerCase()))
    : orders ?? []

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl">Pedidos</h1>
          <p className="text-sm text-muted">Registro de vendas para clientes cadastrados</p>
        </div>
        <Link href="/admin/pedidos/novo" className="bg-accent text-white rounded-lg px-4 py-2 text-sm font-bold whitespace-nowrap">
          + Novo pedido
        </Link>
      </div>

      <form className="flex gap-3 max-w-lg">
        <input
          type="search"
          name="q"
          defaultValue={q ?? ''}
          placeholder="Buscar por cliente..."
          className="input flex-1"
        />
        <select name="status" defaultValue={status ?? ''} className="input w-40">
          <option value="">Todos os status</option>
          <option value="rascunho">Rascunho</option>
          <option value="confirmado">Confirmado</option>
          <option value="cancelado">Cancelado</option>
        </select>
        <button type="submit" className="border border-line rounded-lg px-4 py-2 text-sm font-semibold">
          Filtrar
        </button>
      </form>

      <div className="flex flex-col divide-y divide-line border border-line rounded-lg overflow-hidden bg-white">
        {filtered.map((o: any) => (
          <div key={o.id} className="flex items-center gap-3 p-3 text-sm">
            <div className="flex-1 min-w-0">
              <p className="font-semibold truncate">
                #{o.number} · {o.customers?.name ?? 'Cliente removido'}
              </p>
              <p className="text-xs text-muted truncate">{new Date(o.created_at).toLocaleDateString('pt-BR')}</p>
            </div>
            <span className={`px-2 py-1 rounded-md text-xs font-semibold whitespace-nowrap ${statusClass[o.status as OrderStatus]}`}>
              {statusLabel[o.status as OrderStatus]}
            </span>
            <div className="font-bold tabular-nums text-sm whitespace-nowrap">
              R$ {Number(o.total).toFixed(2).replace('.', ',')}
            </div>
            <div className="flex items-center gap-2 shrink-0">
              {o.status === 'rascunho' && (
                <form action={updateOrderStatus}>
                  <input type="hidden" name="id" value={o.id} />
                  <input type="hidden" name="status" value="confirmado" />
                  <button
                    type="submit"
                    className="rounded-md border border-line px-2.5 py-1.5 text-xs font-semibold text-green-700 hover:bg-green-50"
                  >
                    Confirmar
                  </button>
                </form>
              )}
              <Link
                href={`/admin/pedidos/${o.id}`}
                title="Editar pedido"
                className="inline-flex items-center gap-1 rounded-md border border-line px-2.5 py-1.5 text-xs font-semibold text-accent hover:bg-accent/5"
              >
                <PencilIcon className="w-3.5 h-3.5" />
                Editar
              </Link>
              <form action={deleteOrder}>
                <input type="hidden" name="id" value={o.id} />
                <button
                  type="submit"
                  title="Excluir pedido"
                  className="inline-flex items-center gap-1 rounded-md border border-line px-2.5 py-1.5 text-xs font-semibold text-red-600 hover:bg-red-50"
                >
                  <TrashIcon className="w-3.5 h-3.5" />
                  Excluir
                </button>
              </form>
            </div>
          </div>
        ))}
        {filtered.length === 0 && <p className="p-4 text-sm text-muted">Nenhum pedido encontrado.</p>}
      </div>
    </div>
  )
}
