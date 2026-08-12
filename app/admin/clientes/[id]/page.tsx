import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { resolveActiveCompany } from '@/lib/company'
import CustomerForm from '@/components/CustomerForm'

export default async function EditarClientePage({ params }: { params: Promise<{ id: string }> }) {
  const active = await resolveActiveCompany()
  if (!active.ok) return null

  const { id } = await params
  const supabase = await createClient()
  const { data: customer } = await supabase
    .from('customers')
    .select('*')
    .eq('id', id)
    .eq('company_id', active.companyId)
    .single()

  if (!customer) notFound()

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-display text-2xl">Editar cliente</h1>
        <p className="text-sm text-muted">{customer.name}</p>
      </div>
      <CustomerForm customer={customer} />
    </div>
  )
}
