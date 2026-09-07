import { Suspense } from 'react'
import Image from 'next/image'
import { createClient } from '@/lib/supabase/server'
import { resolveActiveCompany } from '@/lib/company'
import ProductFilterBar from './ProductFilterBar'
import { deleteProduct } from './actions'
import { PencilIcon } from '@/components/icons'
import FillWeightButton from '@/components/FillWeightButton'
import DeleteProductButton from '@/components/DeleteProductButton'
import Button from '@/components/Button'

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

  // Conta independente dos filtros de busca acima: o botão de IA processa
  // todos os produtos pendentes da empresa, não só os que estão na tela.
  const { count: pendingWeightCount } = await supabase
    .from('products')
    .select('id', { count: 'exact', head: true })
    .eq('company_id', active.companyId)
    .is('weight_kg', null)
    .not('image_url', 'is', null)

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl">Produtos</h1>
          <p className="text-sm text-muted">Busca, filtros e gestão do catálogo</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <FillWeightButton pendingCount={pendingWeightCount ?? 0} />
          <Button href="/admin/produtos/novo" className="whitespace-nowrap">
            + Novo produto
          </Button>
        </div>
      </div>

      <Suspense fallback={null}>
        <ProductFilterBar categories={categories ?? []} />
      </Suspense>

      <div className="flex flex-col divide-y divide-line border border-line rounded-lg overflow-hidden bg-white">
        {(products ?? []).map((p: any) => (
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
                {!p.available && ' · Indisponível'}
              </p>
            </div>
            <div className="font-bold tabular-nums text-sm whitespace-nowrap">
              R$ {Number(p.price).toFixed(2).replace('.', ',')}
            </div>
            <div className="flex items-center gap-2 shrink-0 ml-auto sm:ml-0">
              <Button href={`/admin/produtos/${p.id}`} title="Editar produto" variant="ghost-accent" size="sm">
                <PencilIcon className="w-3.5 h-3.5" />
                Editar
              </Button>
              <DeleteProductButton productId={p.id} productName={p.name} deleteProduct={deleteProduct} />
            </div>
          </div>
        ))}
        {(products ?? []).length === 0 && (
          <p className="p-4 text-sm text-muted">
            {q || categoria ? 'Nenhum produto encontrado com esse filtro.' : 'Nenhum produto ainda — cadastre o primeiro acima.'}
          </p>
        )}
      </div>
    </div>
  )
}
