import type { ReactNode } from 'react'

// 6º componente do design system — a única tabela HTML do produto
// (histórico de movimentações de estoque) era crua, sem hover de linha e
// com a cor do delta fora do token (já corrigida à parte no achado P0 da
// segunda auditoria). Ver "Raio-X do Catálogo II", achado P3.
export function Table({ children }: { children: ReactNode }) {
  return (
    <div className="border border-line rounded-lg overflow-x-auto bg-surface">
      <table className="w-full text-sm">{children}</table>
    </div>
  )
}

export function TableHead({ children }: { children: ReactNode }) {
  return (
    <thead>
      <tr className="text-left text-xs text-muted border-b border-line">{children}</tr>
    </thead>
  )
}

export function TableHeaderCell({ children, align = 'left' }: { children: ReactNode; align?: 'left' | 'right' }) {
  return <th className={`px-3 py-2 font-semibold ${align === 'right' ? 'text-right' : ''}`}>{children}</th>
}

export function TableBody({ children }: { children: ReactNode }) {
  return <tbody className="divide-y divide-line">{children}</tbody>
}

export function TableRow({ children }: { children: ReactNode }) {
  return <tr className="hover:bg-ink/5 transition-colors">{children}</tr>
}

export function TableCell({
  children,
  align = 'left',
  numeric = false,
  colSpan,
  className = '',
}: {
  children: ReactNode
  align?: 'left' | 'right'
  // Célula numérica: alinha à direita e usa algarismos tabulares, pra
  // colunas de quantidade/saldo ficarem em coluna reta.
  numeric?: boolean
  colSpan?: number
  className?: string
}) {
  return (
    <td
      colSpan={colSpan}
      className={`px-3 py-2 ${align === 'right' || numeric ? 'text-right' : ''} ${numeric ? 'tabular-nums' : ''} ${className}`}
    >
      {children}
    </td>
  )
}
