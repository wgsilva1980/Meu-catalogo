import { Suspense } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { resolveActiveCompany } from '@/lib/company'
import ProductFilterBar from './ProductFilterBar'
import { deleteProduct } from './actions'
import { PencilIcon, TrashIcon } from '@/components/icons'

export default async function ProdutosPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; categoria?: string }>
}) {
  const active = await resolveActiveCompany()
  if (!active.ok) return null

  const { q, categoria } = await searchParams
  const supabase = await createClient()
  const { data: categories } = await supabase
    .from('categories')
    .select('*')
    .eq('company_id', active.companyId)
    .order('sort_order')

  let query = supabase
    .from('products')
    .select('*, categories(name)')
    .eq('company_id', active.companyId)
    .order('name')
  if (q) query = query.or(`name.ilike.%${q}%,brand.ilike.%${q}%`)
  if (categoria) query = query.eq('category_id', categoria)
  const { data: products } = await query

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl">Produtos</h1>
          <p className="text-sm text-muted">Busca, filtros e gestão do catálogo</p>
        </div>
        <Link href="/admin/produtos/novo" className="bg-accent text-white rounded-lg px-4 py-2 text-sm font-bold whitespace-nowrap">
          + Novo produto
        </Link>
      </div>

      <Suspense fallback={null}>
        <ProductFilterBar categories={categories ?? []} />
      </Suspense>

      <div className="flex flex-col divide-y divide-line border border-line rounded-lg overflow-hidden bg-white">
        {(products ?? []).map((p: any) => (
          <div key={p.id} className="flex flex-wrap items-center gap-3 p-3 text-sm">
            <div className="w-10 h-10 rounded-md bg-paper border border-line shrink-0 overflow-hidden">
              {p.image_url && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={p.image_url} className="w-full h-full object-cover" alt="" />
              )}
            </div>
            <div className="flex-1 min-w-0 basis-full sm:basis-0">
              <p className="font-semibold truncate">{p.name}</p>
              <p className="text-xs text-muted truncate">
                {p.brand} · {p.categories?.name}
                {!p.available && ' · Indisponível'}
              </p>
            </div>
            <div className="font-bold tabular-nums text-sm whitespace-nowrap">
              R$ {Number(p.price).toFixed(2).replace('.', ',')}
            </div>
            <div className="flex items-center gap-2 shrink-0 ml-auto sm:ml-0">
              <Link
                href={`/admin/produtos/${p.id}`}
                title="Editar produto"
                className="inline-flex items-center gap-1 rounded-md border border-line px-2.5 py-1.5 text-xs font-semibold text-accent hover:bg-accent/5"
              >
                <PencilIcon className="w-3.5 h-3.5" />
                Editar
              </Link>
              <form action={deleteProduct}>
                <input type="hidden" name="id" value={p.id} />
                <button
                  type="submit"
                  title="Excluir produto"
                  className="inline-flex items-center gap-1 rounded-md border border-line px-2.5 py-1.5 text-xs font-semibold text-red-600 hover:bg-red-50"
                >
                  <TrashIcon className="w-3.5 h-3.5" />
                  Excluir
                </button>
              </form>
            </div>
          </div>
        ))}
        {(products ?? []).length === 0 && <p className="p-4 text-sm text-muted">Nenhum produto encontrado.</p>}
      </div>
    </div>
  )
}
