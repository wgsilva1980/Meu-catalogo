'use client'

import { useRouter, useSearchParams, usePathname } from 'next/navigation'

const FILTERS = [
  { value: '', label: 'Todos' },
  { value: 'baixo', label: 'Estoque baixo' },
  { value: 'sem', label: 'Sem estoque' },
]

export default function StockFilterBar() {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  function updateParam(key: string, value: string) {
    const params = new URLSearchParams(searchParams.toString())
    if (value) params.set(key, value)
    else params.delete(key)
    params.delete('ok')
    params.delete('erro')
    router.push(`${pathname}?${params.toString()}`)
  }

  const current = searchParams.get('filtro') ?? ''

  return (
    <div className="flex flex-col md:flex-row gap-3">
      <input
        defaultValue={searchParams.get('q') ?? ''}
        onChange={(e) => updateParam('q', e.target.value)}
        placeholder="Buscar por nome ou marca..."
        className="input md:max-w-xs"
      />
      <div className="flex flex-wrap gap-2">
        {FILTERS.map((f) => (
          <button
            key={f.value}
            onClick={() => updateParam('filtro', f.value)}
            className={`px-3 py-1.5 rounded-full text-xs font-semibold border ${
              current === f.value ? 'bg-accent/10 text-accent border-transparent' : 'text-muted border-line'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>
    </div>
  )
}
