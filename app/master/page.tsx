import { createClient } from '@/lib/supabase/server'
import { impersonateCompany, toggleCompanyActive } from './actions'
import { PencilIcon } from '@/components/icons'
import Button from '@/components/Button'
import Badge from '@/components/Badge'

export default async function MasterPage() {
  const supabase = await createClient()
  const { data: companies } = await supabase.from('companies').select('*, products(count)').order('created_at')

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl">Empresas</h1>
          <p className="text-sm text-muted">Todas as empresas cadastradas na plataforma</p>
        </div>
        <Button href="/master/nova" className="whitespace-nowrap">
          + Nova empresa
        </Button>
      </div>

      <div className="flex flex-col divide-y divide-line border border-line rounded-lg overflow-hidden bg-surface">
        {(companies ?? []).map((c: any) => (
          <div key={c.id} className="flex flex-wrap items-center gap-3 p-3 text-sm">
            <div className="flex-1 min-w-0 basis-full sm:basis-0">
              <p className="font-semibold truncate">{c.name}</p>
              <p className="text-xs text-muted truncate">{c.products?.[0]?.count ?? 0} produtos</p>
            </div>
            <Badge variant={c.active ? 'success' : 'danger'}>{c.active ? 'Ativa' : 'Inativa'}</Badge>
            <div className="flex items-center gap-2 shrink-0 ml-auto sm:ml-0 flex-wrap">
              <form action={impersonateCompany}>
                <input type="hidden" name="company_id" value={c.id} />
                <Button type="submit" variant="ghost-accent" size="sm">
                  Entrar como
                </Button>
              </form>
              <Button href={`/master/${c.id}`} title="Editar empresa" variant="ghost" size="sm">
                <PencilIcon className="w-3.5 h-3.5" />
                Editar
              </Button>
              <form action={toggleCompanyActive}>
                <input type="hidden" name="company_id" value={c.id} />
                <input type="hidden" name="active" value={(!c.active).toString()} />
                <Button type="submit" variant="ghost" size="sm">
                  {c.active ? 'Desativar' : 'Ativar'}
                </Button>
              </form>
            </div>
          </div>
        ))}
        {(companies ?? []).length === 0 && (
          <p className="p-4 text-sm text-muted">Nenhuma empresa ainda — cadastre a primeira acima.</p>
        )}
      </div>
    </div>
  )
}
