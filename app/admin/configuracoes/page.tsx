import { createClient } from '@/lib/supabase/server'
import { resolveActiveCompany } from '@/lib/company'
import StoreSettingsForm from '@/components/StoreSettingsForm'
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

  return (
    <div className="flex flex-col gap-6 max-w-2xl">
      <h1 className="text-xl font-bold">Configurações da loja</h1>
      <StoreSettingsForm settings={settings} />
    </div>
  )
}
