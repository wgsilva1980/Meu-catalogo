import { headers } from 'next/headers'
import { createClient } from '@/lib/supabase/server'
import { resolveActiveCompany } from '@/lib/company'
import StoreSettingsForm from '@/components/StoreSettingsForm'
import CopyLinkField from '@/components/CopyLinkField'
import type { Company } from '@/lib/types'

export default async function ConfiguracoesPage() {
  const active = await resolveActiveCompany()
  if (!active.ok) return null

  const supabase = await createClient()
  const { data } = await supabase.from('companies').select('*').eq('id', active.companyId).single()

  const settings: Company = data ?? {
    id: active.companyId,
    name: '',
    slug: '',
    logo_url: null,
    phone: null,
    whatsapp: null,
    instagram: null,
    website: null,
    address: null,
    active: true,
    created_at: new Date().toISOString(),
  }

  const requestHeaders = await headers()
  const host = requestHeaders.get('host')
  const protocol = host?.startsWith('localhost') ? 'http' : 'https'
  const publicSignupUrl = settings.slug ? `${protocol}://${host}/cadastro/${settings.slug}` : null
  const publicOrderUrl = settings.slug ? `${protocol}://${host}/pedido/${settings.slug}` : null

  return (
    <div className="flex flex-col gap-6 max-w-2xl">
      <h1 className="text-xl font-bold">Configurações da loja</h1>
      <StoreSettingsForm settings={settings} />

      {publicSignupUrl && (
        <section className="flex flex-col gap-2 border border-line rounded-xl p-4">
          <h2 className="text-sm font-bold">Link de auto-cadastro</h2>
          <p className="text-xs text-muted">
            Compartilhe este link com seus clientes para que eles se cadastrem diretamente no sistema.
          </p>
          <CopyLinkField url={publicSignupUrl} />
        </section>
      )}

      {publicOrderUrl && (
        <section className="flex flex-col gap-2 border border-line rounded-xl p-4">
          <h2 className="text-sm font-bold">Link de pedido</h2>
          <p className="text-xs text-muted">
            Compartilhe este link para que seus clientes montem e enviem o próprio pedido, sem precisar de cadastro
            prévio. O pedido entra como rascunho para você revisar e confirmar.
          </p>
          <CopyLinkField url={publicOrderUrl} />
        </section>
      )}
    </div>
  )
}
