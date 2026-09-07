import { resolveActiveCompany } from '@/lib/company'
import CustomerForm from '@/components/CustomerForm'
import Alert from '@/components/Alert'

export default async function NovoClientePage({
  searchParams,
}: {
  searchParams: Promise<{ erro?: string }>
}) {
  const active = await resolveActiveCompany()
  if (!active.ok) return null
  const { erro } = await searchParams

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-display text-2xl">Cadastro de cliente</h1>
        <p className="text-sm text-muted">Novo cliente</p>
      </div>
      {erro === 'cpf' && <Alert variant="danger">CPF/CNPJ inválido. Confira os números digitados.</Alert>}
      <CustomerForm />
    </div>
  )
}
