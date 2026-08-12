import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { resolveActiveCompany } from '@/lib/company'
import AdminSidebar from '@/components/AdminSidebar'
import ImpersonationBanner from '@/components/ImpersonationBanner'
import SignOutButton from '@/components/SignOutButton'

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const active = await resolveActiveCompany()

  if (!active.ok) {
    if (active.reason === 'unauthenticated') redirect('/login')
    if (active.reason === 'needs-master') redirect('/master')

    const message =
      active.reason === 'no-company'
        ? 'Sua conta não está vinculada a nenhuma empresa. Contate o administrador.'
        : 'Esta empresa está desativada no momento. Contate o administrador.'

    return (
      <div className="min-h-screen flex items-center justify-center p-6">
        <div className="max-w-sm text-center flex flex-col items-center gap-4">
          <p className="text-sm text-muted">{message}</p>
          <SignOutButton className="text-xs font-semibold text-accent underline" />
        </div>
      </div>
    )
  }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  const { data: company } = await supabase.from('companies').select('name').eq('id', active.companyId).single()

  return (
    <div className="min-h-screen flex flex-col md:flex-row">
      <AdminSidebar email={user?.email ?? ''} companyName={company?.name ?? ''} />
      <main className="flex-1 min-w-0 p-5 md:p-8">
        {active.impersonating && <ImpersonationBanner companyName={company?.name ?? ''} />}
        {children}
      </main>
    </div>
  )
}
