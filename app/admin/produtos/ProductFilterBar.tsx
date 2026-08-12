'use client'

import { useRouter, useSearchParams, usePathname } from 'next/navigation'
import type { Category } from '@/lib/types'

export default function ProductFilterBar({ categories }: { categories: Category[] }) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  function updateParam(key: string, value: string) {
    const params = new URLSearchParams(searchParams.toString())
    if (value) params.set(key, value)
    else params.delete(key)
    router.push(`${pathname}?${params.toString()}`)
  }

  return (
    <div className="flex flex-col md:flex-row gap-3">
      <input
        defaultValue={searchParams.get('q') ?? ''}
        onChange={(e) => updateParam('q', e.target.value)}
        placeholder="Buscar por nome ou marca..."
        className="input md:max-w-xs"
      />
      <div className="flex flex-wrap gap-2">
        <Chip active={!searchParams.get('categoria')} onClick={() => updateParam('categoria', '')}>Todas</Chip>
        {categories.map((c) => (
          <Chip key={c.id} active={searchParams.get('categoria') === c.id} onClick={() => updateParam('categoria', c.id)}>
            {c.name}
          </Chip>
        ))}
      </div>
    </div>
  )
}

function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`px-3 py-1.5 rounded-full text-xs font-semibold border ${
        active ? 'bg-accent/10 text-accent border-transparent' : 'text-muted border-line'
      }`}
    >
      {children}
    </button>
  )
}
