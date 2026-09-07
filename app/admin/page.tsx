import { createClient } from '@/lib/supabase/server'
import { resolveActiveCompany } from '@/lib/company'
import Button from '@/components/Button'

export default async function PainelPage() {
  const active = await resolveActiveCompany()
  if (!active.ok) return null

  const supabase = await createClient()
  const firstDayOfMonth = new Date()
  firstDayOfMonth.setDate(1)
  firstDayOfMonth.setHours(0, 0, 0, 0)

  const [
    { count: totalProdutos },
    { count: totalCategorias },
    { count: totalPromo },
    { count: catalogosMes },
    { data: recentes },
    { data: estoqueRows },
  ] = await Promise.all([
    supabase
      .from('products')
      .select('*', { count: 'exact', head: true })
      .eq('company_id', active.companyId)
      .eq('available', true),
    supabase.from('categories').select('*', { count: 'exact', head: true }).eq('company_id', active.companyId),
    supabase
      .from('products')
      .select('*', { count: 'exact', head: true })
      .eq('company_id', active.companyId)
      .not('promo_note', 'is', null),
    supabase
      .from('generated_catalogs')
      .select('*', { count: 'exact', head: true })
      .eq('company_id', active.companyId)
      .gte('created_at', firstDayOfMonth.toISOString()),
    supabase
      .from('products')
      .select('name, updated_at')
      .eq('company_id', active.companyId)
      .order('updated_at', { ascending: false })
      .limit(5),
    supabase.from('products').select('stock_quantity, low_stock_threshold').eq('company_id', active.companyId),
  ])

  const semEstoque = (estoqueRows ?? []).filter((p: any) => (p.stock_quantity ?? 0) <= 0).length
  const estoqueBaixo = (estoqueRows ?? []).filter(
    (p: any) => (p.stock_quantity ?? 0) > 0 && p.low_stock_threshold > 0 && p.stock_quantity <= p.low_stock_threshold
  ).length

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-display text-2xl">Painel</h1>
        <p className="text-sm text-muted">Visão geral do catálogo</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        <StatCard num={totalProdutos ?? 0} label="Produtos disponíveis" />
        <StatCard num={totalCategorias ?? 0} label="Categorias" />
        <StatCard num={totalPromo ?? 0} label="Em promoção" />
        <StatCard num={catalogosMes ?? 0} label="Catálogos este mês" />
        <StatCard num={semEstoque} label="Sem estoque" tone={semEstoque > 0 ? 'red' : undefined} />
        <StatCard num={estoqueBaixo} label="Estoque baixo" tone={estoqueBaixo > 0 ? 'amber' : undefined} />
      </div>

      <div className="flex flex-wrap gap-3">
        <Button href="/admin/produtos/novo">+ Novo produto</Button>
        <Button href="/admin/catalogo" variant="secondary">
          Gerar catálogo
        </Button>
      </div>

      <div>
        <p className="text-xs uppercase tracking-wide text-muted font-semibold mb-2">Atualizados recentemente</p>
        <div className="flex flex-col divide-y divide-line border-t border-line">
          {(recentes ?? []).map((p, i) => (
            <div key={i} className="py-2 text-sm flex items-center justify-between gap-3">
              <span className="truncate">{p.name}</span>
              <span className="text-muted text-xs shrink-0">{new Date(p.updated_at).toLocaleDateString('pt-BR')}</span>
            </div>
          ))}
          {(recentes ?? []).length === 0 && (
            <p className="py-3 text-sm text-muted">Nenhum produto cadastrado ainda — comece adicionando um acima.</p>
          )}
        </div>
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
