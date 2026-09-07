import type { ReactNode } from 'react'
import { createCompany } from '../actions'
import Button from '@/components/Button'
import Alert from '@/components/Alert'

export default async function NovaEmpresaPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>
}) {
  const { error } = await searchParams

  return (
    <div className="flex flex-col gap-6 max-w-md">
      <div>
        <h1 className="font-display text-2xl">Nova empresa</h1>
        <p className="text-sm text-muted">Cria a empresa e o primeiro login (dono)</p>
      </div>

      {error && (
        <Alert variant="danger" size="sm">
          {error}
        </Alert>
      )}

      <form action={createCompany} className="flex flex-col gap-3">
        <Field label="Nome da empresa">
          <input name="name" required className="input" />
        </Field>
        <Field label="E-mail do dono">
          <input name="email" type="email" required className="input" />
        </Field>
        <Field label="Senha">
          <input name="password" type="password" required minLength={6} className="input" />
        </Field>
        <Button type="submit" className="mt-2">
          Criar empresa
        </Button>
      </form>
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
