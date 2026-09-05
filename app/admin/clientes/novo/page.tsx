import { resolveActiveCompany } from '@/lib/company'
import CustomerForm from '@/components/CustomerForm'

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
      {erro === 'cpf' && (
        <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg p-3">
          CPF/CNPJ inválido. Confira os números digitados.
        </p>
      )}
      <CustomerForm />
    </div>
  )
}
