import Link from 'next/link'
import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { resolveActiveCompany } from '@/lib/company'
import type { StockMovementType } from '@/lib/types'
import StockMovementForms from '@/components/StockMovementForms'
import Alert from '@/components/Alert'
import Badge, { type BadgeVariant } from '@/components/Badge'
import { Table, TableHead, TableHeaderCell, TableBody, TableRow, TableCell } from '@/components/Table'

const OK_MESSAGES: Record<string, string> = {
  entrada: 'Entrada registrada.',
  saida: 'Baixa registrada.',
  ajuste: 'Saldo ajustado.',
  minimo: 'Estoque mínimo atualizado.',
}

const ERRO_MESSAGES: Record<string, string> = {
  insuficiente: 'Estoque insuficiente para essa baixa.',
  quantidade: 'Informe uma quantidade válida.',
  produto: 'Produto não encontrado.',
  falha: 'Não foi possível concluir a operação.',
}

const TYPE_LABEL: Record<StockMovementType, string> = {
  entrada: 'Entrada',
  saida: 'Saída',
  ajuste: 'Ajuste',
}

// Mesma lacuna encontrada em app/admin/clientes/[id]: badge de status
// montado à mão em vez de usar .badge-* (achado P1). Migrado junto na
// Fase 3 (Componentes).
const TYPE_VARIANT: Record<StockMovementType, BadgeVariant> = {
  entrada: 'success',
  saida: 'danger',
  ajuste: 'neutral',
}

export default async function EstoqueProdutoPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ ok?: string; erro?: string }>
}) {
  const active = await resolveActiveCompany()
  if (!active.ok) return null

  const { id } = await params
  const { ok, erro } = await searchParams
  const supabase = await createClient()

  const { data: product } = await supabase
    .from('products')
    .select('id, name, brand, stock_quantity, low_stock_threshold')
    .eq('id', id)
    .eq('company_id', active.companyId)
    .maybeSingle()

  if (!product) notFound()

  const { data: movements } = await supabase
    .from('stock_movements')
    .select('*, sales_orders(number)')
    .eq('product_id', id)
    .eq('company_id', active.companyId)
    .order('created_at', { ascending: false })
    .limit(100)

  return (
    <div className="flex flex-col gap-6 max-w-2xl">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Link href="/admin/estoque" className="text-xs font-semibold text-accent">
            ← Estoque
          </Link>
          <h1 className="font-display text-2xl mt-1">{product.name}</h1>
          <p className="text-sm text-muted">{product.brand}</p>
        </div>
        <div className="text-right">
          <span className="text-xs font-semibold text-muted">Saldo atual</span>
          <p
            className={`text-3xl font-bold tabular-nums ${
              product.stock_quantity <= 0
                ? 'text-danger'
                : product.low_stock_threshold > 0 && product.stock_quantity <= product.low_stock_threshold
                ? 'text-warning'
                : ''
            }`}
          >
            {product.stock_quantity} un.
          </p>
          {product.low_stock_threshold > 0 && (
            <p className="text-xs text-muted">alerta abaixo de {product.low_stock_threshold}</p>
          )}
        </div>
      </div>

      {ok && OK_MESSAGES[ok] && <Alert variant="success">{OK_MESSAGES[ok]}</Alert>}
      {erro && <Alert variant="danger">{ERRO_MESSAGES[erro] ?? ERRO_MESSAGES.falha}</Alert>}

      <StockMovementForms
        productId={product.id}
        currentStock={product.stock_quantity}
        lowStockThreshold={product.low_stock_threshold}
      />

      <section className="flex flex-col gap-2">
        <h2 className="text-sm font-bold">Histórico de movimentações</h2>
        <Table>
          <TableHead>
            <TableHeaderCell>Data</TableHeaderCell>
            <TableHeaderCell>Tipo</TableHeaderCell>
            <TableHeaderCell align="right">Qtd</TableHeaderCell>
            <TableHeaderCell align="right">Saldo</TableHeaderCell>
            <TableHeaderCell>Observação</TableHeaderCell>
          </TableHead>
          <TableBody>
            {(movements ?? []).map((m: any) => (
              <TableRow key={m.id}>
                <TableCell className="whitespace-nowrap text-muted">
                  {new Date(m.created_at).toLocaleDateString('pt-BR')}
                </TableCell>
                <TableCell>
                  <Badge variant={TYPE_VARIANT[m.type as StockMovementType]} size="sm">
                    {TYPE_LABEL[m.type as StockMovementType]}
                  </Badge>
                </TableCell>
                <TableCell numeric className={`font-semibold ${m.delta < 0 ? 'text-danger' : 'text-success'}`}>
                  {m.delta > 0 ? `+${m.delta}` : m.delta}
                </TableCell>
                <TableCell numeric>{m.balance_after}</TableCell>
                <TableCell className="text-muted">
                  {m.sales_orders?.number ? (
                    <Link href={`/admin/pedidos/${m.order_id}`} className="text-accent font-semibold">
                      Pedido #{m.sales_orders.number}
                    </Link>
                  ) : (
                    m.note || '—'
                  )}
                </TableCell>
              </TableRow>
            ))}
            {(movements ?? []).length === 0 && (
              <TableRow>
                <TableCell colSpan={5} className="text-muted">
                  Nenhuma movimentação ainda.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </section>
    </div>
  )
}
