import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { createAdminClient } from '@/lib/supabase/admin'
import CustomerForm from '@/components/CustomerForm'
import StoreFooter from '@/components/StoreFooter'
import { submitPublicCustomer } from './actions'

// Sem isso, compartilhar o link de cadastro (WhatsApp, etc.) gerava uma
// prévia genérica sem nome nem logo da loja — ver "Raio-X do Catálogo",
// achado P2.
export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params
  const supabase = createAdminClient()
  const { data: company } = await supabase
    .from('companies')
    .select('name, logo_url')
    .eq('slug', slug)
    .eq('active', true)
    .single()

  if (!company) return {}

  const title = `Cadastro — ${company.name}`
  const description = 'Cadastre-se para receber o catálogo e fazer pedidos.'
  return {
    title,
    description,
    openGraph: { title, description, images: company.logo_url ? [company.logo_url] : undefined },
    twitter: { card: 'summary', title, description, images: company.logo_url ? [company.logo_url] : undefined },
  }
}

export default async function CadastroPublicoPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>
  searchParams: Promise<{ sucesso?: string }>
}) {
  const { slug } = await params
  const { sucesso } = await searchParams

  const supabase = createAdminClient()
  const { data: company } = await supabase
    .from('companies')
    .select('id, name, logo_url, phone, email, instagram, website')
    .eq('slug', slug)
    .eq('active', true)
    .single()

  if (!company) notFound()

  return (
    <main className="min-h-screen flex items-center justify-center px-6 py-10">
      <div className="w-full max-w-lg card flex flex-col gap-4">
        <div className="flex flex-col items-center gap-2 text-center">
          {company.logo_url && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={company.logo_url} alt={company.name} className="h-12 object-contain" />
          )}
          <span className="text-xs uppercase tracking-widest text-accent font-bold">Cadastro</span>
          <h1 className="font-display text-lg">{company.name}</h1>
          <p className="text-sm text-muted">Cadastre-se para receber nosso catálogo e fazer pedidos.</p>
        </div>

        {sucesso ? (
          <p className="text-sm text-green-700 bg-green-50 border border-green-200 rounded-lg p-4 text-center">
            Cadastro recebido com sucesso! Em breve entraremos em contato.
          </p>
        ) : (
          <CustomerForm
            action={submitPublicCustomer}
            hiddenFields={{ slug }}
            submitLabel="Enviar cadastro"
            cancelHref={null}
            requirePhone
            honeypot
          />
        )}
      </div>
      <StoreFooter company={company} />
    </main>
  )
}
