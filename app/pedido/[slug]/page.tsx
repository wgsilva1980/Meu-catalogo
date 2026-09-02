import { notFound } from 'next/navigation'
import { createAdminClient } from '@/lib/supabase/admin'
import PublicOrderForm from '@/components/PublicOrderForm'
import DocumentLookupForm from '@/components/DocumentLookupForm'

export default async function PedidoPublicoPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>
  searchParams: Promise<{ sucesso?: string; numero?: string; documento?: string }>
}) {
  const { slug } = await params
  const { sucesso, numero, documento } = await searchParams

  const supabase = createAdminClient()
  const { data: company } = await supabase
    .from('companies')
    .select('id, name, logo_url, lalamove_enabled')
    .eq('slug', slug)
    .eq('active', true)
    .single()

  if (!company) notFound()

  const { data: categories } = await supabase
    .from('categories')
    .select('*')
    .eq('company_id', company.id)
    .order('sort_order')

  // Formas de pagamento ativas para o cliente escolher. Se a migration ainda
  // não rodou, a consulta falha e seguimos sem o campo.
  const { data: paymentMethods } = await supabase
    .from('payment_methods')
    .select('id, name')
    .eq('company_id', company.id)
    .eq('active', true)
    .order('sort_order')

  // Só produtos disponíveis E com saldo em estoque. `.gt('stock_quantity', 0)`
  // depende da migration de estoque; se ela ainda não rodou, o erro faz cair
  // para o filtro só de disponibilidade.
  let products: any[] | null = null
  {
    const withStock = await supabase
      .from('products')
      .select('*')
      .eq('company_id', company.id)
      .eq('available', true)
      .gt('stock_quantity', 0)
      .order('name')
    if (withStock.error) {
      const fallback = await supabase
        .from('products')
        .select('*')
        .eq('company_id', company.id)
        .eq('available', true)
        .order('name')
      products = fallback.data
    } else {
      products = withStock.data
    }
  }

  // Etapa de identificação: só avança para o carrinho depois que o cliente
  // informou o CPF (para tentar recuperar um cadastro existente) ou optou
  // por seguir sem informar ("documento=skip").
  const identified = documento !== undefined
  const digits = documento && documento !== 'skip' ? documento.replace(/\D/g, '') : ''

  let foundCustomer = null
  if (digits) {
    const { data: candidates } = await supabase
      .from('customers')
      .select('*')
      .eq('company_id', company.id)
      .not('document', 'is', null)
    foundCustomer = (candidates ?? []).find((c) => (c.document ?? '').replace(/\D/g, '') === digits) ?? null
  }

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
        ) : !identified ? (
          <DocumentLookupForm slug={slug} />
        ) : (
          <PublicOrderForm
            slug={slug}
            categories={categories ?? []}
            products={products ?? []}
            foundCustomer={foundCustomer}
            typedDocument={digits || null}
            motoboyEnabled={Boolean(company.lalamove_enabled)}
            paymentMethods={paymentMethods ?? []}
          />
        )}
      </div>
    </main>
  )
}
