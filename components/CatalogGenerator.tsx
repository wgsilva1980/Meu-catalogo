'use client'

import { useState } from 'react'
import Button from '@/components/Button'
import type { Category } from '@/lib/types'

export default function CatalogGenerator({ categories }: { categories: Category[] }) {
  const [mode, setMode] = useState<'all' | 'selection'>('all')
  const [selected, setSelected] = useState<string[]>([])
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  function toggle(id: string) {
    setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]))
  }

  async function handleGenerate() {
    setLoading(true)
    setError(null)
    setResult(null)
    const scope = mode === 'all' ? { type: 'all' } : { type: 'selection', categoryIds: selected }
    const res = await fetch('/api/catalogo/gerar', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ scope }),
    })
    setLoading(false)
    let data: { url?: string; error?: string } = {}
    try {
      data = await res.json()
    } catch {
      setError('Erro ao gerar o catálogo. Verifique o console do servidor.')
      return
    }
    if (!res.ok) {
      setError(data.error ?? 'Erro ao gerar o catálogo.')
      return
    }
    setResult(data.url ?? null)
  }

  return (
    <div className="flex flex-col gap-4 max-w-md">
      <div className="flex flex-col gap-2">
        <button
          onClick={() => setMode('all')}
          className={`text-left border rounded-lg p-3 text-sm ${mode === 'all' ? 'border-accent bg-accent/10' : 'border-line'}`}
        >
          <div className="font-bold">Catálogo completo</div>
          <div className="text-xs text-muted">Todas as categorias e produtos disponíveis</div>
        </button>
        <button
          onClick={() => setMode('selection')}
          className={`text-left border rounded-lg p-3 text-sm ${mode === 'selection' ? 'border-accent bg-accent/10' : 'border-line'}`}
        >
          <div className="font-bold">Seleção personalizada</div>
          <div className="text-xs text-muted">Escolher categorias específicas</div>
        </button>
      </div>

      {mode === 'selection' && (
        <div className="flex flex-col divide-y divide-line border border-line rounded-lg">
          {categories.map((c) => (
            <label key={c.id} className="flex items-center justify-between p-2 text-sm">
              {c.name}
              <input type="checkbox" checked={selected.includes(c.id)} onChange={() => toggle(c.id)} />
            </label>
          ))}
        </div>
      )}

      <Button
        type="button"
        onClick={handleGenerate}
        disabled={loading || (mode === 'selection' && selected.length === 0)}
        className="disabled:opacity-50"
      >
        {loading ? 'Gerando PDF...' : 'Gerar PDF'}
      </Button>

      {error && <p className="text-xs text-danger">{error}</p>}
      {result && (
        <a href={result} target="_blank" rel="noreferrer" className="text-sm font-semibold text-accent underline">
          Baixar catálogo gerado
        </a>
      )}
    </div>
  )
}
