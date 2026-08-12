import { resolveActiveCompany } from '@/lib/company'
import CustomerForm from '@/components/CustomerForm'

export default async function NovoClientePage() {
  const active = await resolveActiveCompany()
  if (!active.ok) return null

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-display text-2xl">Cadastro de cliente</h1>
        <p className="text-sm text-muted">Novo cliente</p>
      </div>
      <CustomerForm />
    </div>
  )
}
