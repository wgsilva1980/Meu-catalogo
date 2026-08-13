import { createClient } from '@/lib/supabase/server'
import { resolveActiveCompany } from '@/lib/company'
import CatalogGenerator from '@/components/CatalogGenerator'

export default async function GerarCatalogoPage() {
  const active = await resolveActiveCompany()
  if (!active.ok) return null

  const supabase = await createClient()
  const { data: categories } = await supabase
    .from('categories')
    .select('*')
    .eq('company_id', active.companyId)
    .order('sort_order')
  const { data: recentes } = await supabase
    .from('generated_catalogs')
    .select('*')
    .eq('company_id', active.companyId)
    .order('created_at', { ascending: false })
    .limit(5)

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-display text-2xl">Gerar catálogo</h1>
        <p className="text-sm text-muted">Configurar e exportar o PDF</p>
      </div>

      <CatalogGenerator categories={categories ?? []} />

      <div>
        <p className="text-xs uppercase tracking-wide text-muted font-semibold mb-2">Gerados recentemente</p>
        <div className="flex flex-col divide-y divide-line border-t border-line max-w-md">
          {(recentes ?? []).map((r: any) => (
            <div key={r.id} className="py-2 text-sm flex items-center justify-between gap-3">
              <span className="truncate">{r.scope?.type === 'all' ? 'Catálogo completo' : 'Seleção personalizada'}</span>
              <span className="text-muted text-xs shrink-0">{new Date(r.created_at).toLocaleDateString('pt-BR')}</span>
            </div>
          ))}
          {(recentes ?? []).length === 0 && <p className="py-3 text-sm text-muted">Nenhum catálogo gerado ainda.</p>}
        </div>
      </div>
    </div>
  )
}
