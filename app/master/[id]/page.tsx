import type { ReactNode } from 'react'
import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { updateCompany } from '../actions'

export default async function EditarEmpresaPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: company } = await supabase.from('companies').select('*').eq('id', id).single()

  if (!company) notFound()

  return (
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

        <div className="grid grid-cols-2 gap-3">
          <Field label="Telefone">
            <input name="phone" defaultValue={company.phone ?? ''} className="input" />
          </Field>
          <Field label="WhatsApp">
            <input name="whatsapp" defaultValue={company.whatsapp ?? ''} className="input" />
          </Field>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Instagram">
            <input name="instagram" defaultValue={company.instagram ?? ''} className="input" />
          </Field>
          <Field label="Website">
            <input name="website" defaultValue={company.website ?? ''} className="input" />
          </Field>
        </div>

        <Field label="Endereço">
          <textarea name="address" defaultValue={company.address ?? ''} className="input h-16" />
        </Field>

        <button type="submit" className="bg-accent text-white rounded-lg px-4 py-2 text-sm font-bold mt-2">
          Salvar
        </button>
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
