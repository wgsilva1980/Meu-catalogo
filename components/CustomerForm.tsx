'use client'

import { useState } from 'react'
import type { ReactNode } from 'react'
import { saveCustomer } from '@/app/admin/clientes/actions'
import type { Customer } from '@/lib/types'

type ViaCepResponse = {
  erro?: boolean
  logradouro?: string
  bairro?: string
  localidade?: string
  uf?: string
  complemento?: string
}

export default function CustomerForm({
  customer,
  action = saveCustomer,
  hiddenFields,
  submitLabel = 'Salvar cliente',
  cancelHref = '/admin/clientes',
  requirePhone = false,
  honeypot = false,
}: {
  customer?: Customer
  action?: (formData: FormData) => void | Promise<void>
  hiddenFields?: Record<string, string>
  submitLabel?: string
  cancelHref?: string | null
  requirePhone?: boolean
  honeypot?: boolean
}) {
  const [zipCode, setZipCode] = useState(customer?.zip_code ?? '')
  const [street, setStreet] = useState(customer?.street ?? '')
  const [complement, setComplement] = useState(customer?.complement ?? '')
  const [neighborhood, setNeighborhood] = useState(customer?.neighborhood ?? '')
  const [city, setCity] = useState(customer?.city ?? '')
  const [state, setState] = useState(customer?.state ?? '')
  const [cepStatus, setCepStatus] = useState<'idle' | 'loading' | 'not-found' | 'error'>('idle')

  async function handleZipCodeChange(e: React.ChangeEvent<HTMLInputElement>) {
    const raw = e.target.value
    setZipCode(raw)

    const digits = raw.replace(/\D/g, '')
    if (digits.length !== 8) {
      setCepStatus('idle')
      return
    }

    setCepStatus('loading')
    try {
      const res = await fetch(`https://viacep.com.br/ws/${digits}/json/`)
      const data: ViaCepResponse = await res.json()
      if (data.erro) {
        setCepStatus('not-found')
        return
      }
      setStreet(data.logradouro ?? '')
      setNeighborhood(data.bairro ?? '')
      setCity(data.localidade ?? '')
      setState(data.uf ?? '')
      if (data.complemento) setComplement(data.complemento)
      setCepStatus('idle')
    } catch {
      setCepStatus('error')
    }
  }

  return (
    <form action={action} className="flex flex-col gap-3 max-w-2xl">
      {customer && <input type="hidden" name="id" value={customer.id} />}
      {hiddenFields &&
        Object.entries(hiddenFields).map(([key, value]) => <input key={key} type="hidden" name={key} value={value} />)}
      {honeypot && (
        <div aria-hidden="true" style={{ position: 'absolute', left: '-9999px', width: 1, height: 1, overflow: 'hidden' }}>
          <label>
            Não preencha este campo
            <input type="text" name="company_website" tabIndex={-1} autoComplete="off" defaultValue="" />
          </label>
        </div>
      )}

      <Field label="Nome">
        <input name="name" defaultValue={customer?.name} required className="input" />
      </Field>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Field label="Telefone/WhatsApp">
          <input
            name="phone"
            defaultValue={customer?.phone ?? ''}
            placeholder="(00) 00000-0000"
            required={requirePhone}
            className="input"
          />
        </Field>
        <Field label="E-mail">
          <input name="email" type="email" defaultValue={customer?.email ?? ''} className="input" />
        </Field>
      </div>

      <Field label="CPF/CNPJ">
        <input name="document" defaultValue={customer?.document ?? ''} className="input max-w-xs" />
      </Field>

      <section className="flex flex-col gap-3 border border-line rounded-xl p-4">
        <h2 className="text-sm font-bold">Endereço</h2>

        <div className="flex items-end gap-3">
          <Field label="CEP">
            <input
              name="zip_code"
              value={zipCode}
              onChange={handleZipCodeChange}
              placeholder="00000-000"
              inputMode="numeric"
              maxLength={9}
              className="input max-w-[10rem]"
            />
          </Field>
          {cepStatus === 'loading' && <span className="text-xs text-muted pb-2">Buscando endereço...</span>}
          {cepStatus === 'not-found' && <span className="text-xs text-red-600 pb-2">CEP não encontrado.</span>}
          {cepStatus === 'error' && <span className="text-xs text-red-600 pb-2">Falha ao buscar o CEP.</span>}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-[1fr_8rem] gap-3">
          <Field label="Rua">
            <input name="street" value={street} onChange={(e) => setStreet(e.target.value)} className="input" />
          </Field>
          <Field label="Número">
            <input name="number" defaultValue={customer?.number ?? ''} className="input" />
          </Field>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Field label="Complemento">
            <input name="complement" value={complement} onChange={(e) => setComplement(e.target.value)} className="input" />
          </Field>
          <Field label="Bairro">
            <input name="neighborhood" value={neighborhood} onChange={(e) => setNeighborhood(e.target.value)} className="input" />
          </Field>
        </div>

        <div className="grid grid-cols-[1fr_6rem] gap-3">
          <Field label="Cidade">
            <input name="city" value={city} onChange={(e) => setCity(e.target.value)} className="input" />
          </Field>
          <Field label="UF">
            <input name="state" value={state} onChange={(e) => setState(e.target.value.toUpperCase())} maxLength={2} className="input" />
          </Field>
        </div>
      </section>

      <Field label="Observações">
        <textarea name="notes" defaultValue={customer?.notes ?? ''} className="input h-20" />
      </Field>

      <div className="flex flex-wrap gap-2 justify-end mt-2">
        {cancelHref && (
          <a href={cancelHref} className="border border-line rounded-lg px-4 py-2 text-sm font-semibold">Cancelar</a>
        )}
        <button type="submit" className="bg-accent text-white rounded-lg px-4 py-2 text-sm font-bold">{submitLabel}</button>
      </div>
    </form>
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
