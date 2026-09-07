import { Suspense } from 'react'
import Image from 'next/image'
import { createClient } from '@/lib/supabase/server'
import { resolveActiveCompany } from '@/lib/company'
import type { Product } from '@/lib/types'
import StockFilterBar from '@/components/StockFilterBar'
import Alert from '@/components/Alert'
import Button from '@/components/Button'

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

function stockState(p: Pick<Product, 'stock_quantity' | 'low_stock_threshold'>) {
  if (p.stock_quantity <= 0) return 'sem' as const
  if (p.low_stock_threshold > 0 && p.stock_quantity <= p.low_stock_threshold) return 'baixo' as const
  return 'ok' as const
}

export default async function EstoquePage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; filtro?: string; ok?: string; erro?: string }>
}) {
  const active = await resolveActiveCompany()
  if (!active.ok) return null

  const { q, filtro, ok, erro } = await searchParams
  const supabase = await createClient()

  const { data } = await supabase
    .from('products')
    .select('id, name, brand, image_url, stock_quantity, low_stock_threshold, categories(name)')
    .eq('company_id', active.companyId)
    .order('name')

  const products = (data ?? []) as any[]

  const summary = {
    skus: products.length,
    sem: products.filter((p) => stockState(p) === 'sem').length,
    baixo: products.filter((p) => stockState(p) === 'baixo').length,
    unidades: products.reduce((sum, p) => sum + Math.max(0, p.stock_quantity ?? 0), 0),
  }

  const term = (q ?? '').trim().toLowerCase()
  const filtered = products.filter((p) => {
    if (term && !(`${p.name} ${p.brand}`.toLowerCase().includes(term))) return false
    if (filtro === 'sem' && stockState(p) !== 'sem') return false
    if (filtro === 'baixo' && stockState(p) !== 'baixo') return false
    return true
  })

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1 className="font-display text-2xl">Estoque</h1>
        <p className="text-sm text-muted">Saldo por produto, entradas, baixas e ajustes</p>
      </div>

      {ok && OK_MESSAGES[ok] && <Alert variant="success">{OK_MESSAGES[ok]}</Alert>}
      {erro && <Alert variant="danger">{ERRO_MESSAGES[erro] ?? ERRO_MESSAGES.falha}</Alert>}

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard num={summary.skus} label="Produtos" />
        <StatCard num={summary.sem} label="Sem estoque" tone={summary.sem > 0 ? 'red' : undefined} />
        <StatCard num={summary.baixo} label="Estoque baixo" tone={summary.baixo > 0 ? 'amber' : undefined} />
        <StatCard num={summary.unidades} label="Unidades em estoque" />
      </div>

      <Suspense fallback={null}>
        <StockFilterBar />
      </Suspense>

      <div className="flex flex-col divide-y divide-line border border-line rounded-lg overflow-hidden bg-surface">
        {filtered.map((p) => {
          const state = stockState(p)
          return (
            <div key={p.id} className="flex flex-wrap items-center gap-3 p-3 text-sm">
              <div className="relative w-10 h-10 rounded-md bg-paper border border-line shrink-0 overflow-hidden">
                {p.image_url && (
                  <Image src={p.image_url} alt={`${p.name} — ${p.brand}`} fill sizes="40px" className="object-cover" />
                )}
              </div>
              <div className="flex-1 min-w-0 basis-full sm:basis-0">
                <p className="font-semibold truncate">{p.name}</p>
                <p className="text-xs text-muted truncate">
                  {p.brand} · {p.categories?.name}
                  {p.low_stock_threshold > 0 && ` · mín. ${p.low_stock_threshold}`}
                </p>
              </div>
              <div
                className={`font-bold tabular-nums whitespace-nowrap ${
                  state === 'sem' ? 'text-danger' : state === 'baixo' ? 'text-warning' : ''
                }`}
              >
                {p.stock_quantity ?? 0} un.
              </div>
              <div className="flex items-center gap-2 shrink-0 ml-auto sm:ml-0">
                <Button href={`/admin/estoque/${p.id}`} variant="ghost-accent" size="sm">
                  Movimentar
                </Button>
              </div>
            </div>
          )
        })}
        {filtered.length === 0 && (
          <p className="p-4 text-sm text-muted">
            {term || filtro ? 'Nenhum produto encontrado com esse filtro.' : 'Nenhum produto cadastrado ainda.'}
          </p>
        )}
      </div>
    </div>
  )
}

function StatCard({ num, label, tone }: { num: number; label: string; tone?: 'red' | 'amber' }) {
  const toneClass = tone === 'red' ? 'text-danger' : tone === 'amber' ? 'text-warning' : ''
  return (
    <div className="border border-line rounded-lg p-3 bg-surface">
      <div className={`text-2xl font-bold tabular-nums ${toneClass}`}>{num}</div>
      <div className="text-xs text-muted">{label}</div>
    </div>
  )
}
