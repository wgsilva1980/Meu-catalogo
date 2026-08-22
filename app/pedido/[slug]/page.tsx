import { notFound } from 'next/navigation'
import { createAdminClient } from '@/lib/supabase/admin'
import PublicOrderForm from '@/components/PublicOrderForm'

export default async function PedidoPublicoPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>
  searchParams: Promise<{ sucesso?: string; numero?: string }>
}) {
  const { slug } = await params
  const { sucesso, numero } = await searchParams

  const supabase = createAdminClient()
  const { data: company } = await supabase
    .from('companies')
    .select('id, name, logo_url')
    .eq('slug', slug)
    .eq('active', true)
    .single()

  if (!company) notFound()

  const { data: categories } = await supabase
    .from('categories')
    .select('*')
    .eq('company_id', company.id)
    .order('sort_order')

  const { data: products } = await supabase
    .from('products')
    .select('*')
    .eq('company_id', company.id)
    .eq('available', true)
    .order('name')

  return (
    <main className="min-h-screen flex items-start justify-center px-4 py-10">
      <div className="w-full max-w-2xl bg-white border border-line rounded-2xl p-6 flex flex-col gap-4">
        <div className="flex flex-col items-center gap-2 text-center">
          {company.logo_url && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={company.logo_url} alt={company.name} className="h-12 object-contain" />
          )}
          <h1 className="font-display text-xl">{company.name}</h1>
          <p className="text-sm text-muted">Monte seu pedido abaixo. Entraremos em contato para confirmar.</p>
        </div>

        {sucesso ? (
          <p className="text-sm text-green-700 bg-green-50 border border-green-200 rounded-lg p-4 text-center">
            Pedido {numero ? `#${numero} ` : ''}recebido com sucesso! Em breve entraremos em contato.
          </p>
        ) : (
          <PublicOrderForm slug={slug} categories={categories ?? []} products={products ?? []} />
        )}
      </div>
    </main>
  )
}
