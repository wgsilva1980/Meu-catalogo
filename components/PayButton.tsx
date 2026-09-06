'use client'

import { useState } from 'react'

export default function PayButton({ token, label = 'Pagar agora' }: { token: string; label?: string }) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function pay() {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/acompanhar/${token}/pagar`, { method: 'POST' })
      const data = await res.json()
      if (!res.ok || !data.initPoint) {
        setError(data.error ?? 'Não foi possível iniciar o pagamento.')
        setLoading(false)
        return
      }
      window.location.href = data.initPoint
    } catch {
      setError('Não foi possível iniciar o pagamento.')
      setLoading(false)
    }
  }

  return (
    <div className="flex flex-col gap-1">
      <button
        type="button"
        onClick={pay}
        disabled={loading}
        className="bg-accent text-white rounded-lg px-4 py-2 text-sm font-bold disabled:opacity-50 w-fit"
      >
        {loading ? 'Abrindo pagamento...' : label}
      </button>
      {error && <p className="text-xs text-red-600">{error}</p>}
      <p className="text-xs text-muted">Você será levado ao Mercado Pago (Pix, cartão ou transferência).</p>
    </div>
  )
}
