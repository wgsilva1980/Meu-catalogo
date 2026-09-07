import type { ReactNode } from 'react'
import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import {
  updateCompany,
  createCompanyUser,
  updateUserRole,
  setUserActive,
  resetUserPassword,
  removeUser,
} from '../actions'
import Button from '@/components/Button'
import Badge from '@/components/Badge'
import Alert from '@/components/Alert'

export default async function EditarEmpresaPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ error?: string }>
}) {
  const { id } = await params
  const { error } = await searchParams
  const supabase = await createClient()
  const {
    data: { user: currentUser },
  } = await supabase.auth.getUser()

  const { data: company } = await supabase.from('companies').select('*').eq('id', id).single()
  if (!company) notFound()

  const { data: profiles } = await supabase
    .from('profiles')
    .select('*')
    .eq('company_id', id)
    .order('created_at')

  const adminClient = createAdminClient()
  const users = await Promise.all(
    (profiles ?? []).map(async (p) => {
      const { data } = await adminClient.auth.admin.getUserById(p.id)
      const bannedUntil = data.user?.banned_until
      const banned = !!bannedUntil && bannedUntil !== 'none' && new Date(bannedUntil) > new Date()
      return {
        id: p.id,
        role: p.role as 'owner' | 'staff',
        email: data.user?.email ?? '—',
        banned,
      }
    })
  )

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-6 max-w-md">
        <div>
          <h1 className="font-display text-2xl">Editar empresa</h1>
          <p className="text-sm text-muted">{company.name}</p>
        </div>

        <form action={updateCompany} className="flex flex-col gap-3">
          <input type="hidden" name="company_id" value={company.id} />

          <Field label="Nome da empresa">
            <input name="name" defaultValue={company.name} required className="input" />
          </Field>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Field label="Telefone / WhatsApp">
              <input name="phone" defaultValue={company.phone ?? ''} className="input" />
            </Field>
            <Field label="E-mail da loja">
              <input name="email" type="email" defaultValue={company.email ?? ''} className="input" />
            </Field>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Field label="Instagram">
              <input name="instagram" defaultValue={company.instagram ?? ''} className="input" />
            </Field>
            <Field label="Website">
              <input name="website" defaultValue={company.website ?? ''} className="input" />
            </Field>
          </div>

          <Button type="submit" className="mt-2">
            Salvar
          </Button>
        </form>
      </div>

      <div className="flex flex-col gap-4 max-w-2xl">
        <div>
          <h2 className="font-display text-xl">Usuários</h2>
          <p className="text-sm text-muted">Logins com acesso ao painel desta empresa</p>
        </div>

        {error && (
          <Alert variant="danger" size="sm">
            {error}
          </Alert>
        )}

        <div className="flex flex-col divide-y divide-line border border-line rounded-lg overflow-hidden bg-white">
          {users.map((u) => {
            const isSelf = u.id === currentUser?.id
            return (
              <div key={u.id} className="flex flex-wrap items-center gap-3 p-3 text-sm">
                <div className="flex-1 min-w-0 basis-full sm:basis-0">
                  <p className="font-semibold truncate">
                    {u.email}
                    {isSelf && <span className="text-xs text-muted font-normal"> (você)</span>}
                  </p>
                </div>

                <Badge variant={u.role === 'owner' ? 'accent' : 'neutral'}>{u.role === 'owner' ? 'Dono' : 'Equipe'}</Badge>
                <Badge variant={u.banned ? 'danger' : 'success'}>{u.banned ? 'Desativado' : 'Ativo'}</Badge>

                <div className="flex items-center gap-2 flex-wrap shrink-0 ml-auto sm:ml-0">
                  <form action={updateUserRole} className="flex items-center gap-1">
                    <input type="hidden" name="user_id" value={u.id} />
                    <input type="hidden" name="company_id" value={company.id} />
                    <select name="role" defaultValue={u.role} className="input py-1 px-2 text-xs w-24">
                      <option value="owner">Dono</option>
                      <option value="staff">Equipe</option>
                    </select>
                    <button type="submit" className="text-xs font-semibold text-accent">
                      Salvar
                    </button>
                  </form>

                  <form action={setUserActive}>
                    <input type="hidden" name="user_id" value={u.id} />
                    <input type="hidden" name="company_id" value={company.id} />
                    <input type="hidden" name="active" value={(!!u.banned).toString()} />
                    <Button type="submit" variant="ghost" size="sm" disabled={isSelf} className="disabled:opacity-30">
                      {u.banned ? 'Ativar' : 'Desativar'}
                    </Button>
                  </form>

                  <details>
                    <summary className="cursor-pointer list-none inline-block btn btn-sm btn-ghost">
                      Redefinir senha
                    </summary>
                    <form action={resetUserPassword} className="flex items-center gap-2 mt-2">
                      <input type="hidden" name="user_id" value={u.id} />
                      <input type="hidden" name="company_id" value={company.id} />
                      <input
                        type="password"
                        name="password"
                        minLength={6}
                        required
                        placeholder="Nova senha"
                        className="input py-1 px-2 text-xs w-32"
                      />
                      <button type="submit" className="text-xs font-semibold text-accent whitespace-nowrap">
                        Salvar senha
                      </button>
                    </form>
                  </details>

                  <form action={removeUser}>
                    <input type="hidden" name="user_id" value={u.id} />
                    <input type="hidden" name="company_id" value={company.id} />
                    <Button type="submit" variant="danger" size="sm" disabled={isSelf} className="disabled:opacity-30">
                      Remover
                    </Button>
                  </form>
                </div>
              </div>
            )
          })}
          {users.length === 0 && (
            <p className="p-4 text-sm text-muted">Nenhum usuário ainda — adicione o primeiro abaixo.</p>
          )}
        </div>

        <form action={createCompanyUser} className="flex flex-col gap-3 card-tight">
          <input type="hidden" name="company_id" value={company.id} />
          <h3 className="text-sm font-bold">+ Adicionar usuário</h3>
          <div className="grid grid-cols-1 sm:grid-cols-[1fr_1fr_8rem] gap-3">
            <Field label="E-mail">
              <input name="email" type="email" required className="input" />
            </Field>
            <Field label="Senha">
              <input name="password" type="password" required minLength={6} className="input" />
            </Field>
            <Field label="Papel">
              <select name="role" defaultValue="staff" className="input">
                <option value="staff">Equipe</option>
                <option value="owner">Dono</option>
              </select>
            </Field>
          </div>
          <Button type="submit" className="self-end">
            Criar usuário
          </Button>
        </form>
      </div>
    </div>
  )
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="flex flex-col gap-1 text-xs font-semibold text-muted">
      {label}
      {children}
    </label>
  )
}
