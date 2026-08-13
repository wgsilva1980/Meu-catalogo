import { createClient } from '@/lib/supabase/server'
import { resolveActiveCompany } from '@/lib/company'
import { addCategory, deleteCategory } from './actions'

export default async function CategoriasPage() {
  const active = await resolveActiveCompany()
  if (!active.ok) return null

  const supabase = await createClient()
  const { data: categories } = await supabase
    .from('categories')
    .select('*, products(count)')
    .eq('company_id', active.companyId)
    .order('sort_order')

  return (
    <div className="flex flex-col gap-5 max-w-2xl">
      <div>
        <h1 className="font-display text-2xl">Categorias</h1>
        <p className="text-sm text-muted">Organização do catálogo</p>
      </div>

      <div className="border border-line rounded-lg overflow-hidden bg-white divide-y divide-line">
        {(categories ?? []).map((c: any) => (
          <div key={c.id} className="flex flex-wrap items-center gap-3 p-3 text-sm">
            <span className="font-semibold flex-1 min-w-0 truncate">{c.name}</span>
            <span className="text-xs text-muted whitespace-nowrap">{c.products?.[0]?.count ?? 0} produtos</span>
            {c.is_fixed ? (
              <span className="text-xs text-muted border border-line rounded px-2 py-0.5">fixa</span>
            ) : (
              <form action={deleteCategory}>
                <input type="hidden" name="id" value={c.id} />
                <button className="text-xs font-semibold text-red-600">Excluir</button>
              </form>
            )}
          </div>
        ))}
        {(categories ?? []).length === 0 && <p className="p-4 text-sm text-muted">Nenhuma categoria cadastrada.</p>}
      </div>

      <form action={addCategory} className="flex gap-2">
        <input name="name" required placeholder="Nova categoria personalizada" className="input flex-1" />
        <button className="bg-accent text-white rounded-lg px-4 py-2 text-sm font-bold whitespace-nowrap">Adicionar</button>
      </form>
    </div>
  )
}
