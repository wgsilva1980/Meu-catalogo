import Link from 'next/link'
import type { AnchorHTMLAttributes, ButtonHTMLAttributes, ReactNode } from 'react'

// Fase 3 do plano de redesign ("Raio-X do Catálogo", seção 11) — as classes
// .btn* já centralizavam a aparência (app/globals.css) desde a Fase de
// componentização anterior, mas cada tela ainda escrevia o próprio
// <button>/<Link> e colava a combinação de classes à mão. Isso extrai o
// componente de verdade: um só lugar decide variant/size, e as ~15+ telas
// que usam botão primário/secundário/perigo passam a chamar <Button>.
//
// Polimórfico por necessidade real do produto, não por generalidade: todo
// `href` encontrado nas telas hoje é uma rota interna (nenhum link externo
// usa .btn), então `href` sempre vira <Link> — navegação client-side em vez
// de recarregar a página, o que os poucos lugares que ainda usavam <a href>
// pra rota interna (MelhorEnvioCard, MercadoPagoCard) ganham de graça.
export type ButtonVariant = 'primary' | 'secondary' | 'danger' | 'ghost' | 'ghost-accent' | 'ghost-success'
export type ButtonSize = 'md' | 'sm'

const variantClass: Record<ButtonVariant, string> = {
  primary: 'btn-primary',
  secondary: 'btn-secondary',
  danger: 'btn-danger',
  ghost: 'btn-ghost',
  'ghost-accent': 'btn-ghost-accent',
  'ghost-success': 'btn-ghost-success',
}

function classes(variant: ButtonVariant, size: ButtonSize, className?: string) {
  return ['btn', size === 'sm' ? 'btn-sm' : '', variantClass[variant], className ?? ''].filter(Boolean).join(' ')
}

type BaseProps = {
  variant?: ButtonVariant
  size?: ButtonSize
  className?: string
  children: ReactNode
}

type AsLink = BaseProps &
  Omit<AnchorHTMLAttributes<HTMLAnchorElement>, 'className' | 'href'> & {
    href: string
  }

type AsButton = BaseProps &
  Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'className' | 'href'> & {
    href?: undefined
  }

export type ButtonProps = AsLink | AsButton

export default function Button({ variant = 'primary', size = 'md', className, children, ...rest }: ButtonProps) {
  const cls = classes(variant, size, className)

  if ('href' in rest && rest.href) {
    const { href, ...linkProps } = rest as Omit<AsLink, keyof BaseProps>
    return (
      <Link href={href} className={cls} {...linkProps}>
        {children}
      </Link>
    )
  }

  // `type` não tem default aqui de propósito: sem o atributo, um <button>
  // dentro de um <form> é `submit` por padrão do próprio HTML — vários dos
  // botões migrados dependem exatamente desse comportamento implícito.
  return (
    <button className={cls} {...(rest as Omit<AsButton, keyof BaseProps>)}>
      {children}
    </button>
  )
}
