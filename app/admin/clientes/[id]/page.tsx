import Link from 'next/link'
import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { resolveActiveCompany } from '@/lib/company'
import CustomerForm from '@/components/CustomerForm'
import Badge, { type BadgeVariant } from '@/components/Badge'
import Alert from '@/components/Alert'
import type { OrderStatus } from '@/lib/types'

const statusLabel: Record<OrderStatus, string> = {
  rascunho: 'Rascunho',
  confirmado: 'Confirmado',
  cancelado: 'Cancelado',
}

// Achada durante a Fase 3 (Componentes) do plano de redesign: essa tela
// tinha ficado de fora da centralização de badge de status feita antes
// (achado P1) — ainda montava a cor à mão em vez de usar .badge-*.
const statusVariant: Record<OrderStatus, BadgeVariant> = {
  rascunho: 'neutral',
  confirmado: 'success',
  cancelado: 'danger',
}

export default async function EditarClientePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ erro?: string }>
}) {
  const active = await resolveActiveCompany()
  if (!active.ok) return null

  const { id } = await params
  const { erro } = await searchParams
  const supabase = await createClient()
  const { data: customer } = await supabase
    .from('customers')
    .select('*')
    .eq('id', id)
    .eq('company_id', active.companyId)
    .single()

  if (!customer) notFound()

  const { data: orders } = await supabase
    .from('sales_orders')
    .select('*')
    .eq('customer_id', id)
    .eq('company_id', active.companyId)
    .order('created_at', { ascending: false })

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-display text-2xl">Editar cliente</h1>
        <p className="text-sm text-muted">{customer.name}</p>
      </div>
      {erro === 'cpf' && <Alert variant="danger">CPF/CNPJ inválido. Confira os números digitados.</Alert>}
      <CustomerForm customer={customer} />

      <div>
        <h2 className="font-display text-lg mb-3">Pedidos do cliente</h2>
        <div className="flex flex-col divide-y divide-line border border-line rounded-lg overflow-hidden bg-surface">
          {(orders ?? []).map((o: any) => (
            <Link
              key={o.id}
              href={`/admin/pedidos/${o.id}`}
              className="flex flex-wrap items-center gap-3 p-3 text-sm hover:bg-accent/5 transition-colors"
            >
              <div className="flex-1 min-w-0 basis-full sm:basis-0">
                <p className="font-semibold truncate">#{o.number}</p>
                <p className="text-xs text-muted truncate">{new Date(o.created_at).toLocaleDateString('pt-BR')}</p>
              </div>
              <Badge variant={statusVariant[o.status as OrderStatus]} className="whitespace-nowrap">
                {statusLabel[o.status as OrderStatus]}
              </Badge>
              <div className="font-bold tabular-nums text-sm whitespace-nowrap">
                R$ {Number(o.total).toFixed(2).replace('.', ',')}
              </div>
            </Link>
          ))}
          {(orders ?? []).length === 0 && (
            <p className="p-4 text-sm text-muted">Nenhum pedido encontrado para este cliente.</p>
          )}
        </div>
      </div>
    </div>
  )
}
