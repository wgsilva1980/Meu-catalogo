'use client'

import { useState } from 'react'
import { isValidCpfCnpj } from '@/lib/cpfCnpj'
import Button from '@/components/Button'

export default function DocumentLookupForm({ slug }: { slug: string }) {
  const [error, setError] = useState(false)

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    const value = new FormData(e.currentTarget).get('documento') as string
    if (value.trim() && !isValidCpfCnpj(value)) {
      e.preventDefault()
      setError(true)
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <form className="flex flex-col gap-2" onSubmit={handleSubmit}>
        <label className="flex flex-col gap-1 text-xs font-semibold text-muted">
          CPF
          <input
            name="documento"
            placeholder="000.000.000-00"
            inputMode="numeric"
            onChange={() => setError(false)}
            className={`input ${error ? 'border-red-500' : ''}`}
          />
          {error && <span className="text-xs font-normal text-danger">CPF/CNPJ inválido.</span>}
        </label>
        <p className="text-xs text-muted">
          Informe seu CPF para localizarmos seu cadastro, se já tiver um.
        </p>
        <Button type="submit">Continuar</Button>
      </form>
      <a href={`/pedido/${slug}?documento=skip`} className="text-xs text-muted underline text-center">
        Não tenho CPF, continuar sem informar
      </a>
    </div>
  )
}
