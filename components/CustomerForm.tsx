'use client'

import { useState } from 'react'
import type { ReactNode } from 'react'
import { saveCustomer } from '@/app/admin/clientes/actions'
import { isValidCpfCnpj } from '@/lib/cpfCnpj'
import Card from '@/components/Card'
import Button from '@/components/Button'
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
  defaultDocument,
}: {
  customer?: Customer
  action?: (formData: FormData) => void | Promise<void>
  hiddenFields?: Record<string, string>
  submitLabel?: string
  cancelHref?: string | null
  requirePhone?: boolean
  honeypot?: boolean
  // CPF já digitado antes deste formulário (ex.: na busca de identificação
  // do pedido, que não encontrou cadastro) — vem pronto no campo em vez de
  // pedir para digitar de novo.
  defaultDocument?: string
}) {
  const [zipCode, setZipCode] = useState(customer?.zip_code ?? '')
  const [street, setStreet] = useState(customer?.street ?? '')
  const [complement, setComplement] = useState(customer?.complement ?? '')
  const [neighborhood, setNeighborhood] = useState(customer?.neighborhood ?? '')
  const [city, setCity] = useState(customer?.city ?? '')
  const [state, setState] = useState(customer?.state ?? '')
  const [cepStatus, setCepStatus] = useState<'idle' | 'loading' | 'not-found' | 'error'>('idle')
  const [document, setDocument] = useState(customer?.document ?? defaultDocument ?? '')
  const [documentError, setDocumentError] = useState(false)

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

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    if (!isValidCpfCnpj(document)) {
      e.preventDefault()
      setDocumentError(true)
    }
  }

  return (
    <form action={action} onSubmit={handleSubmit} className="flex flex-col gap-3 max-w-2xl">
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
        <input
          name="document"
          value={document}
          onChange={(e) => {
            setDocument(e.target.value)
            setDocumentError(false)
          }}
          onBlur={() => setDocumentError(!isValidCpfCnpj(document))}
          className={`input max-w-xs ${documentError ? 'border-red-500' : ''}`}
        />
        {documentError && <span className="text-xs font-normal text-danger">CPF/CNPJ inválido.</span>}
      </Field>

      <Card as="section" tight className="flex flex-col gap-3">
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
          <span role="status" aria-live="polite">
            {cepStatus === 'loading' && <span className="text-xs text-muted pb-2">Buscando endereço...</span>}
            {cepStatus === 'not-found' && <span className="text-xs text-danger pb-2">CEP não encontrado.</span>}
            {cepStatus === 'error' && <span className="text-xs text-danger pb-2">Falha ao buscar o CEP.</span>}
          </span>
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
      </Card>

      <Field label="Observações">
        <textarea name="notes" defaultValue={customer?.notes ?? ''} className="input h-20" />
      </Field>

      <div className="flex flex-wrap gap-2 justify-end mt-2">
        {cancelHref && (
          <Button href={cancelHref} variant="secondary">
            Cancelar
          </Button>
        )}
        <Button type="submit">{submitLabel}</Button>
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
