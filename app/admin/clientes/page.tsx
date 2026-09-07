import { createClient } from '@/lib/supabase/server'
import { resolveActiveCompany } from '@/lib/company'
import { deleteCustomer } from './actions'
import { PencilIcon, TrashIcon } from '@/components/icons'
import Button from '@/components/Button'

export default async function ClientesPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>
}) {
  const active = await resolveActiveCompany()
  if (!active.ok) return null

  const { q } = await searchParams
  const supabase = await createClient()

  let query = supabase.from('customers').select('*').eq('company_id', active.companyId).order('name')
  if (q) query = query.or(`name.ilike.%${q}%,phone.ilike.%${q}%,email.ilike.%${q}%`)
  const { data: customers } = await query

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl">Clientes</h1>
          <p className="text-sm text-muted">Cadastro de clientes da loja</p>
        </div>
        <Button href="/admin/clientes/novo" className="whitespace-nowrap">
          + Novo cliente
        </Button>
      </div>

      <form className="max-w-sm">
        <input
          type="search"
          name="q"
          defaultValue={q ?? ''}
          placeholder="Buscar por nome, telefone ou e-mail..."
          className="input w-full"
        />
      </form>

      <div className="flex flex-col divide-y divide-line border border-line rounded-lg overflow-hidden bg-white">
        {(customers ?? []).map((c) => (
          <div key={c.id} className="flex flex-wrap items-center gap-3 p-3 text-sm">
            <div className="flex-1 min-w-0 basis-full sm:basis-0">
              <p className="font-semibold truncate">{c.name}</p>
              <p className="text-xs text-muted truncate">
                {[c.phone, c.email].filter(Boolean).join(' · ') || 'Sem contato cadastrado'}
              </p>
            </div>
            <div className="flex items-center gap-2 shrink-0 ml-auto sm:ml-0">
              <Button href={`/admin/clientes/${c.id}`} title="Editar cliente" variant="ghost-accent" size="sm">
                <PencilIcon className="w-3.5 h-3.5" />
                Editar
              </Button>
              <form action={deleteCustomer}>
                <input type="hidden" name="id" value={c.id} />
                <Button type="submit" title="Excluir cliente" variant="danger" size="sm">
                  <TrashIcon className="w-3.5 h-3.5" />
                  Excluir
                </Button>
              </form>
            </div>
          </div>
        ))}
        {(customers ?? []).length === 0 && (
          <p className="p-4 text-sm text-muted">
            {q ? 'Nenhum cliente encontrado com esse termo.' : 'Nenhum cliente cadastrado ainda — cadastre o primeiro acima.'}
          </p>
        )}
      </div>
    </div>
  )
}
