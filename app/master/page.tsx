import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { impersonateCompany, toggleCompanyActive } from './actions'
import { PencilIcon } from '@/components/icons'

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
        <Link
          href="/master/nova"
          className="bg-accent text-white rounded-lg px-4 py-2 text-sm font-bold whitespace-nowrap"
        >
          + Nova empresa
        </Link>
      </div>

      <div className="flex flex-col divide-y divide-line border border-line rounded-lg overflow-hidden bg-white">
        {(companies ?? []).map((c: any) => (
          <div key={c.id} className="flex flex-wrap items-center gap-3 p-3 text-sm">
            <div className="flex-1 min-w-0 basis-full sm:basis-0">
              <p className="font-semibold truncate">{c.name}</p>
              <p className="text-xs text-muted truncate">{c.products?.[0]?.count ?? 0} produtos</p>
            </div>
            <span
              className={`text-xs font-semibold rounded-full px-2.5 py-1 whitespace-nowrap ${
                c.active ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
              }`}
            >
              {c.active ? 'Ativa' : 'Inativa'}
            </span>
            <div className="flex items-center gap-2 shrink-0 ml-auto sm:ml-0 flex-wrap">
              <form action={impersonateCompany}>
                <input type="hidden" name="company_id" value={c.id} />
                <button
                  type="submit"
                  className="rounded-md border border-line px-2.5 py-1.5 text-xs font-semibold text-accent hover:bg-accent/5"
                >
                  Entrar como
                </button>
              </form>
              <Link
                href={`/master/${c.id}`}
                title="Editar empresa"
                className="inline-flex items-center gap-1 rounded-md border border-line px-2.5 py-1.5 text-xs font-semibold text-muted hover:bg-black/5"
              >
                <PencilIcon className="w-3.5 h-3.5" />
                Editar
              </Link>
              <form action={toggleCompanyActive}>
                <input type="hidden" name="company_id" value={c.id} />
                <input type="hidden" name="active" value={(!c.active).toString()} />
                <button
                  type="submit"
                  className="rounded-md border border-line px-2.5 py-1.5 text-xs font-semibold text-muted hover:bg-black/5"
                >
                  {c.active ? 'Desativar' : 'Ativar'}
                </button>
              </form>
            </div>
          </div>
        ))}
        {(companies ?? []).length === 0 && <p className="p-4 text-sm text-muted">Nenhuma empresa cadastrada ainda.</p>}
      </div>
    </div>
  )
}
