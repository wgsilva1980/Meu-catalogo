import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { resolveActiveCompany } from '@/lib/company'

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
  ])

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-display text-2xl">Painel</h1>
        <p className="text-sm text-muted">Visão geral do catálogo</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard num={totalProdutos ?? 0} label="Produtos disponíveis" />
        <StatCard num={totalCategorias ?? 0} label="Categorias" />
        <StatCard num={totalPromo ?? 0} label="Em promoção" />
        <StatCard num={catalogosMes ?? 0} label="Catálogos este mês" />
      </div>

      <div className="flex flex-wrap gap-3">
        <Link href="/admin/produtos/novo" className="bg-accent text-white rounded-lg px-4 py-2 text-sm font-bold">
          + Novo produto
        </Link>
        <Link href="/admin/catalogo" className="border border-line rounded-lg px-4 py-2 text-sm font-bold">
          Gerar catálogo
        </Link>
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
          {(recentes ?? []).length === 0 && <p className="py-3 text-sm text-muted">Nenhum produto cadastrado ainda.</p>}
        </div>
      </div>
    </div>
  )
}

function StatCard({ num, label }: { num: number; label: string }) {
  return (
    <div className="border border-line rounded-lg p-3 bg-white">
      <div className="text-2xl font-bold tabular-nums">{num}</div>
      <div className="text-xs text-muted">{label}</div>
    </div>
  )
}
