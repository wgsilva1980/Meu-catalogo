import { createClient } from '@/lib/supabase/server'
import { resolveActiveCompany } from '@/lib/company'
import ProductForm from '@/components/ProductForm'

export default async function NovoProdutoPage() {
  const active = await resolveActiveCompany()
  if (!active.ok) return null

  const supabase = await createClient()
  const { data: categories } = await supabase
    .from('categories')
    .select('*')
    .eq('company_id', active.companyId)
    .order('sort_order')

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-display text-2xl">Cadastro de produto</h1>
        <p className="text-sm text-muted">Novo item no catálogo</p>
      </div>
      <ProductForm categories={categories ?? []} />
    </div>
  )
}
