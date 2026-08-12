import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { resolveActiveCompany } from '@/lib/company'
import ProductForm from '@/components/ProductForm'

export default async function EditarProdutoPage({ params }: { params: Promise<{ id: string }> }) {
  const active = await resolveActiveCompany()
  if (!active.ok) return null

  const { id } = await params
  const supabase = await createClient()
  const [{ data: categories }, { data: product }] = await Promise.all([
    supabase.from('categories').select('*').eq('company_id', active.companyId).order('sort_order'),
    supabase.from('products').select('*').eq('id', id).eq('company_id', active.companyId).single(),
  ])

  if (!product) notFound()

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-display text-2xl">Editar produto</h1>
        <p className="text-sm text-muted">{product.name}</p>
      </div>
      <ProductForm categories={categories ?? []} product={product} />
    </div>
  )
}
