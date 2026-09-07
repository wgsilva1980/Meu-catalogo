import { createClient } from '@/lib/supabase/server'
import { resolveActiveCompany } from '@/lib/company'
import { deleteOrder, updateOrderStatus } from './actions'
import DeleteOrderButton from '@/components/DeleteOrderButton'
import { PencilIcon, ClockIcon, CheckIcon, XIcon, AlertIcon } from '@/components/icons'
import Button from '@/components/Button'
import Badge, { type BadgeVariant } from '@/components/Badge'
import Alert from '@/components/Alert'
import type { OrderStatus } from '@/lib/types'

const statusLabel: Record<OrderStatus, string> = {
  rascunho: 'Rascunho',
  confirmado: 'Confirmado',
  cancelado: 'Cancelado',
}

const statusVariant: Record<OrderStatus, BadgeVariant> = {
  rascunho: 'neutral',
  confirmado: 'success',
  cancelado: 'danger',
}

// Cor sozinha não é sinal suficiente (daltonismo, leitor de tela) — cada
// status de pedido/pagamento ganha um ícone próprio ao lado do texto.
const statusIcon: Record<OrderStatus, typeof ClockIcon> = {
  rascunho: ClockIcon,
  confirmado: CheckIcon,
  cancelado: XIcon,
}

export default async function PedidosPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string; erro?: string; pedido?: string; faltam?: string }>
}) {
  const active = await resolveActiveCompany()
  if (!active.ok) return null

  const { q, status, erro, pedido, faltam } = await searchParams
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

  // Pago mas sem baixar estoque (estoque faltou na hora que o Mercado Pago
  // aprovou) ou pagamento estornado depois — nenhum dos dois aparece só
  // pelo status/paid_at do pedido, então busca à parte pra sinalizar na
  // lista em vez de ficar só no log do servidor.
  const orderIds = filtered.map((o: any) => o.id)
  const { data: payments } = orderIds.length
    ? await supabase.from('payments').select('order_id, status').in('order_id', orderIds)
    : { data: [] }
  const paymentStatusByOrder = new Map((payments ?? []).map((p) => [p.order_id, p.status]))

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl">Pedidos</h1>
          <p className="text-sm text-muted">Registro de vendas para clientes cadastrados</p>
        </div>
        <Button href="/admin/pedidos/novo" className="whitespace-nowrap">
          + Novo pedido
        </Button>
      </div>

      {erro === 'estoque' && (
        <Alert variant="danger">
          {pedido ? `Pedido #${pedido}: ` : ''}
          estoque insuficiente{faltam ? ` para: ${faltam}` : ''}. Dê entrada no estoque antes de confirmar.
        </Alert>
      )}

      <form className="flex flex-col sm:flex-row gap-3 max-w-lg">
        <input
          type="search"
          name="q"
          defaultValue={q ?? ''}
          placeholder="Buscar por cliente..."
          className="input flex-1"
        />
        <div className="flex gap-3">
          <select name="status" defaultValue={status ?? ''} className="input w-full sm:w-40">
            <option value="">Todos os status</option>
            <option value="rascunho">Rascunho</option>
            <option value="confirmado">Confirmado</option>
            <option value="cancelado">Cancelado</option>
          </select>
          <Button type="submit" variant="secondary" className="whitespace-nowrap">
            Filtrar
          </Button>
        </div>
      </form>

      <div className="flex flex-col divide-y divide-line border border-line rounded-lg overflow-hidden bg-surface">
        {filtered.map((o: any) => (
          <div key={o.id} className="flex flex-wrap items-center gap-3 p-3 text-sm">
            <div className="flex-1 min-w-0 basis-full sm:basis-0">
              <p className="font-semibold truncate">
                #{o.number} · {o.customers?.name ?? 'Cliente removido'}
              </p>
              <p className="text-xs text-muted truncate">{new Date(o.created_at).toLocaleDateString('pt-BR')}</p>
            </div>
            <Badge variant={statusVariant[o.status as OrderStatus]} size="sm">
              {(() => {
                const StatusIcon = statusIcon[o.status as OrderStatus]
                return <StatusIcon className="w-3 h-3" />
              })()}
              {statusLabel[o.status as OrderStatus]}
            </Badge>
            {o.status === 'confirmado' && o.paid_at && !o.stock_committed && (
              <Badge
                variant="warning"
                size="sm"
                title="O pagamento foi aprovado mas o estoque não pôde ser baixado automaticamente — provavelmente faltou saldo na hora."
              >
                <AlertIcon className="w-3 h-3" />
                Revisar estoque
              </Badge>
            )}
            {(paymentStatusByOrder.get(o.id) === 'refunded' || paymentStatusByOrder.get(o.id) === 'cancelled') && (
              <Badge variant="danger" size="sm">
                <XIcon className="w-3 h-3" />
                {paymentStatusByOrder.get(o.id) === 'refunded' ? 'Estornado' : 'Pagamento cancelado'}
              </Badge>
            )}
            <div className="font-bold tabular-nums text-sm whitespace-nowrap">
              R$ {Number(o.total).toFixed(2).replace('.', ',')}
            </div>
            <div className="flex items-center gap-2 shrink-0 ml-auto sm:ml-0">
              {o.status === 'rascunho' && (
                <form action={updateOrderStatus}>
                  <input type="hidden" name="id" value={o.id} />
                  <input type="hidden" name="status" value="confirmado" />
                  <Button type="submit" variant="ghost-success" size="sm">
                    Confirmar
                  </Button>
                </form>
              )}
              <Button href={`/admin/pedidos/${o.id}`} title="Editar pedido" variant="ghost-accent" size="sm">
                <PencilIcon className="w-3.5 h-3.5" />
                Editar
              </Button>
              <DeleteOrderButton
                orderId={o.id}
                orderNumber={o.number}
                disabledReason={o.status === 'confirmado' ? 'Pedidos confirmados não podem ser excluídos.' : null}
                deleteOrder={deleteOrder}
              />
            </div>
          </div>
        ))}
        {filtered.length === 0 && (
          <p className="p-4 text-sm text-muted">
            {q || status ? 'Nenhum pedido encontrado com esse filtro.' : 'Nenhum pedido registrado ainda.'}
          </p>
        )}
      </div>
    </div>
  )
}
