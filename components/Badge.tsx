import type { HTMLAttributes, ReactNode } from 'react'

// Extraído junto com Button/Card/Alert (Fase 3 do plano de redesign) — as
// classes .badge* (app/globals.css) já centralizavam a aparência, isso
// formaliza o componente e migra "todos os badges de status" (pedido,
// pagamento, cliente/usuário ativo) pra ele, como o plano pede.
export type BadgeVariant = 'success' | 'warning' | 'danger' | 'neutral' | 'promo' | 'accent'

const variantClass: Record<BadgeVariant, string> = {
  success: 'badge-success',
  warning: 'badge-warning',
  danger: 'badge-danger',
  neutral: 'badge-neutral',
  promo: 'badge-promo',
  // Só usado no papel "owner" (app/master/[id]) — não vira classe global em
  // globals.css porque não é um status (sucesso/erro/etc.), é a cor de
  // marca marcando um papel específico.
  accent: 'bg-accent/10 text-accent',
}

export type BadgeProps = HTMLAttributes<HTMLSpanElement> & {
  variant: BadgeVariant
  size?: 'md' | 'sm'
  children: ReactNode
}

export default function Badge({ variant, size = 'md', className, children, ...rest }: BadgeProps) {
  const cls = ['badge', size === 'sm' ? 'badge-sm' : '', variantClass[variant], className ?? ''].filter(Boolean).join(' ')
  return (
    <span className={cls} {...rest}>
      {children}
    </span>
  )
}
