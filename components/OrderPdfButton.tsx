'use client'

import { useState } from 'react'

export default function OrderPdfButton({ orderId }: { orderId: string }) {
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function handleGenerate() {
    setLoading(true)
    setError(null)
    setResult(null)
    const res = await fetch(`/api/pedidos/${orderId}/pdf`, { method: 'POST' })
    setLoading(false)
    let data: { url?: string; error?: string } = {}
    try {
      data = await res.json()
    } catch {
      setError('Erro ao gerar o PDF. Verifique o console do servidor.')
      return
    }
    if (!res.ok) {
      setError(data.error ?? 'Erro ao gerar o PDF.')
      return
    }
    setResult(data.url ?? null)
  }

  return (
    <div className="flex items-center gap-3">
      {result && (
        <a href={result} target="_blank" rel="noreferrer" className="text-sm font-semibold text-accent underline">
          Baixar PDF
        </a>
      )}
      {error && <span className="text-xs text-red-600">{error}</span>}
      <button
        type="button"
        onClick={handleGenerate}
        disabled={loading}
        className="border border-line rounded-lg px-4 py-2 text-sm font-semibold disabled:opacity-50"
      >
        {loading ? 'Gerando PDF...' : 'Gerar PDF'}
      </button>
    </div>
  )
}
