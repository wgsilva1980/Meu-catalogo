import type { HTMLAttributes, ReactNode } from 'react'

// Extraído junto com Button/Badge/Alert (Fase 3 do plano de redesign) — as
// classes .card/.card-tight (app/globals.css) já centralizavam a aparência,
// isso só formaliza o wrapper que ~30 telas repetiam como <div className="...">.
//
// `as`: a maioria dos usos de card-tight no produto já é um <section> (um
// agrupamento com sentido próprio — "Endereço", "Pagamento" — não uma div
// genérica). Manter isso como prop em vez de fixar em <div> preserva esse
// HTML semântico em vez de nivelar tudo pra div.
export type CardProps = HTMLAttributes<HTMLElement> & {
  tight?: boolean
  as?: 'div' | 'section'
  children: ReactNode
}

export default function Card({ tight, as: Tag = 'div', className, children, ...rest }: CardProps) {
  const cls = [tight ? 'card-tight' : 'card', className ?? ''].filter(Boolean).join(' ')
  return (
    <Tag className={cls} {...rest}>
      {children}
    </Tag>
  )
}
