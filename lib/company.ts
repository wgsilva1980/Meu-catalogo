import { cache } from 'react'
import { cookies } from 'next/headers'
import { createClient } from '@/lib/supabase/server'

export const IMPERSONATION_COOKIE = 'impersonate_company_id'

export type ActiveCompanyResult =
  | {
      ok: true
      userId: string
      isSuperAdmin: boolean
      companyId: string
      role: 'owner' | 'staff' | null
      impersonating: boolean
    }
  | { ok: false; reason: 'unauthenticated' | 'needs-master' | 'no-company' | 'company-inactive' }

// Resolve qual empresa o usuário autenticado está operando agora.
// Para super-admins, a empresa ativa vem do cookie de impersonation (setado
// ao clicar "Entrar como" em /master); para os demais, é a empresa do
// próprio perfil. Não redireciona sozinha — cada chamador decide o que
// fazer com cada motivo de falha (Server Component usa redirect(),
// Route Handler devolve 401/403).
export const resolveActiveCompany = cache(async (): Promise<ActiveCompanyResult> => {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { ok: false, reason: 'unauthenticated' }

  const { data: profile } = await supabase
    .from('profiles')
    .select('company_id, role, is_super_admin')
    .eq('id', user.id)
    .single()

  if (!profile) return { ok: false, reason: 'unauthenticated' }

  if (profile.is_super_admin) {
    const cookieStore = await cookies()
    const impersonatedId = cookieStore.get(IMPERSONATION_COOKIE)?.value
    if (!impersonatedId) return { ok: false, reason: 'needs-master' }

    const { data: company } = await supabase.from('companies').select('id').eq('id', impersonatedId).single()
    if (!company) return { ok: false, reason: 'needs-master' }

    return {
      ok: true,
      userId: user.id,
      isSuperAdmin: true,
      companyId: company.id,
      role: profile.role,
      impersonating: true,
    }
  }

  if (!profile.company_id) return { ok: false, reason: 'no-company' }

  const { data: company } = await supabase.from('companies').select('active').eq('id', profile.company_id).single()
  if (!company?.active) return { ok: false, reason: 'company-inactive' }

  return {
    ok: true,
    userId: user.id,
    isSuperAdmin: false,
    companyId: profile.company_id,
    role: profile.role,
    impersonating: false,
  }
})
