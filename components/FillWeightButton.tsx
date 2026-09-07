'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Button from '@/components/Button'

export default function FillWeightButton({ pendingCount }: { pendingCount: number }) {
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState<string | null>(null)

  async function handleClick() {
    setBusy(true)
    setResult(null)
    try {
      const res = await fetch('/api/produtos/preencher-peso', { method: 'POST' })
      const data = await res.json()
      if (!res.ok) {
        setResult(data.error ?? 'Falha ao preencher o peso dos produtos.')
        return
      }
      setResult(
        data.skipped > 0
          ? `${data.updated} produto(s) atualizado(s). ${data.skipped} sem peso legível na foto — preencha manualmente.`
          : `${data.updated} produto(s) atualizado(s) com sucesso.`
      )
      router.refresh()
    } catch {
      setResult('Falha ao preencher o peso dos produtos.')
    } finally {
      setBusy(false)
    }
  }

  if (pendingCount === 0 && !result) return null

  return (
    <div className="flex flex-col gap-1.5 items-end">
      <Button
        type="button"
        onClick={handleClick}
        disabled={busy || pendingCount === 0}
        variant="secondary"
        size="sm"
        className="whitespace-nowrap disabled:opacity-50"
      >
        {busy ? 'Lendo rótulos com IA...' : `Preencher peso com IA (${pendingCount} pendente${pendingCount === 1 ? '' : 's'})`}
      </Button>
      {result && <p className="text-xs text-muted max-w-xs text-right">{result}</p>}
    </div>
  )
}
