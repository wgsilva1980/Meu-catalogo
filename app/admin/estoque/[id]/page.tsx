import Link from 'next/link'
import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { resolveActiveCompany } from '@/lib/company'
import type { StockMovementType } from '@/lib/types'
import StockMovementForms from '@/components/StockMovementForms'

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

const TYPE_CLASS: Record<StockMovementType, string> = {
  entrada: 'bg-green-100 text-green-700',
  saida: 'bg-red-100 text-red-700',
  ajuste: 'bg-black/5 text-muted',
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
                ? 'text-red-600'
                : product.low_stock_threshold > 0 && product.stock_quantity <= product.low_stock_threshold
                ? 'text-amber-600'
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

      {ok && OK_MESSAGES[ok] && (
        <p className="rounded-lg border border-green-200 bg-green-50 text-green-700 text-sm px-3 py-2">{OK_MESSAGES[ok]}</p>
      )}
      {erro && (
        <p className="rounded-lg border border-red-200 bg-red-50 text-red-700 text-sm px-3 py-2">
          {ERRO_MESSAGES[erro] ?? ERRO_MESSAGES.falha}
        </p>
      )}

      <StockMovementForms
        productId={product.id}
        currentStock={product.stock_quantity}
        lowStockThreshold={product.low_stock_threshold}
      />

      <section className="flex flex-col gap-2">
        <h2 className="text-sm font-bold">Histórico de movimentações</h2>
        <div className="border border-line rounded-lg overflow-x-auto bg-white">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-muted border-b border-line">
                <th className="px-3 py-2 font-semibold">Data</th>
                <th className="px-3 py-2 font-semibold">Tipo</th>
                <th className="px-3 py-2 font-semibold text-right">Qtd</th>
                <th className="px-3 py-2 font-semibold text-right">Saldo</th>
                <th className="px-3 py-2 font-semibold">Observação</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {(movements ?? []).map((m: any) => (
                <tr key={m.id}>
                  <td className="px-3 py-2 whitespace-nowrap text-muted">
                    {new Date(m.created_at).toLocaleDateString('pt-BR')}
                  </td>
                  <td className="px-3 py-2">
                    <span className={`px-2 py-0.5 rounded-md text-xs font-semibold ${TYPE_CLASS[m.type as StockMovementType]}`}>
                      {TYPE_LABEL[m.type as StockMovementType]}
                    </span>
                  </td>
                  <td className={`px-3 py-2 text-right tabular-nums font-semibold ${m.delta < 0 ? 'text-red-600' : 'text-green-700'}`}>
                    {m.delta > 0 ? `+${m.delta}` : m.delta}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums">{m.balance_after}</td>
                  <td className="px-3 py-2 text-muted">
                    {m.sales_orders?.number ? (
                      <Link href={`/admin/pedidos/${m.order_id}`} className="text-accent font-semibold">
                        Pedido #{m.sales_orders.number}
                      </Link>
                    ) : (
                      m.note || '—'
                    )}
                  </td>
                </tr>
              ))}
              {(movements ?? []).length === 0 && (
                <tr>
                  <td colSpan={5} className="px-3 py-4 text-muted">
                    Nenhuma movimentação ainda.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  )
}
