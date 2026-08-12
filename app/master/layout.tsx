import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import MasterSidebar from '@/components/MasterSidebar'

export default async function MasterLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase.from('profiles').select('is_super_admin').eq('id', user.id).single()
  if (!profile?.is_super_admin) redirect('/admin')

  return (
    <div className="min-h-screen flex flex-col md:flex-row">
      <MasterSidebar email={user.email ?? ''} />
      <main className="flex-1 min-w-0 p-5 md:p-8">{children}</main>
    </div>
  )
}
