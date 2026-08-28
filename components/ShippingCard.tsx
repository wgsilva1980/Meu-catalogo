'use client'

import { useState } from 'react'
import type { Shipment } from '@/lib/types'

type QuoteOption = {
  id: number
  name: string
  price: string
  delivery_time: number
  company: { id: number; name: string; picture: string }
}

export default function ShippingCard({ orderId, connected, shipment }: { orderId: string; connected: boolean; shipment: Shipment | null }) {
  const [options, setOptions] = useState<QuoteOption[]>([])
  const [selected, setSelected] = useState<QuoteOption | null>(null)
  const [loading, setLoading] = useState(false)
  const [purchasing, setPurchasing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [printUrl, setPrintUrl] = useState<string | null>(shipment?.print_url ?? null)

  async function handleCalculate() {
    setLoading(true)
    setError(null)
    setOptions([])
    setSelected(null)
    try {
      const res = await fetch(`/api/pedidos/${orderId}/frete/calcular`, { method: 'POST' })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error ?? 'Falha ao calcular frete.')
        return
      }
      setOptions(data.options ?? [])
      if (!data.options || data.options.length === 0) setError('Nenhuma opção de frete disponível para este endereço.')
    } catch {
      setError('Falha ao calcular frete.')
    } finally {
      setLoading(false)
    }
  }

  async function handlePurchase() {
    if (!selected) return
    setPurchasing(true)
    setError(null)
    try {
      const res = await fetch(`/api/pedidos/${orderId}/frete/comprar`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ service_id: selected.id, service_name: selected.name, price: Number(selected.price) }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error ?? 'Falha ao gerar etiqueta.')
        return
      }
      setPrintUrl(data.printUrl)
    } catch {
      setError('Falha ao gerar etiqueta.')
    } finally {
      setPurchasing(false)
    }
  }

  if (!connected) {
    return (
      <section className="flex flex-col gap-2 border border-line rounded-xl p-4">
        <h2 className="text-sm font-bold">Frete</h2>
        <p className="text-xs text-muted">
          Conecte sua conta do Melhor Envio em{' '}
          <a href="/admin/configuracoes" className="text-accent underline">
            Configurações
          </a>{' '}
          para calcular frete e gerar etiquetas.
        </p>
      </section>
    )
  }

  if (shipment?.status === 'gerado' && printUrl) {
    return (
      <section className="flex flex-col gap-2 border border-line rounded-xl p-4">
        <h2 className="text-sm font-bold">Frete</h2>
        <p className="text-sm">
          Etiqueta gerada — {shipment.service_name} · R$ {Number(shipment.price ?? 0).toFixed(2).replace('.', ',')}
        </p>
        <a href={printUrl} target="_blank" rel="noreferrer" className="text-sm font-semibold text-accent underline w-fit">
          Ver/imprimir etiqueta
        </a>
      </section>
    )
  }

  return (
    <section className="flex flex-col gap-3 border border-line rounded-xl p-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-bold">Frete</h2>
        <button
          type="button"
          onClick={handleCalculate}
          disabled={loading}
          className="border border-line rounded-lg px-3 py-1.5 text-xs font-semibold disabled:opacity-50"
        >
          {loading ? 'Calculando...' : 'Calcular frete'}
        </button>
      </div>

      {error && <p className="text-xs text-red-600">{error}</p>}

      {options.length > 0 && (
        <div className="flex flex-col gap-2">
          {options.map((option) => (
            <label
              key={option.id}
              className={`flex items-center gap-3 p-3 rounded-lg border text-sm cursor-pointer ${
                selected?.id === option.id ? 'border-accent bg-accent/5' : 'border-line'
              }`}
            >
              <input type="radio" name="shipping_option" checked={selected?.id === option.id} onChange={() => setSelected(option)} />
              <span className="flex-1">
                <span className="font-semibold">
                  {option.company.name} · {option.name}
                </span>
                <span className="block text-xs text-muted">Prazo: {option.delivery_time} dia(s) úteis</span>
              </span>
              <span className="font-bold tabular-nums">R$ {Number(option.price).toFixed(2).replace('.', ',')}</span>
            </label>
          ))}

          <button
            type="button"
            onClick={handlePurchase}
            disabled={!selected || purchasing}
            className="bg-accent text-white rounded-lg px-4 py-2 text-sm font-bold disabled:opacity-50 w-fit mt-1"
          >
            {purchasing ? 'Gerando etiqueta...' : 'Comprar e gerar etiqueta'}
          </button>
          <p className="text-xs text-muted">Isso debita o valor do frete da sua carteira do Melhor Envio.</p>
        </div>
      )}
    </section>
  )
}
