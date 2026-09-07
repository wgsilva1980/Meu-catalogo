import type { HTMLAttributes, ReactNode } from 'react'

// 4º componente extraído nesta fase (junto com Button/Card/Badge) — antes
// disso cada mensagem de sucesso/erro era um <p> com a mesma combinação de
// bg-{cor}-50/border-{cor}-200/text-{cor}-700 colada à mão, com pequenas
// variações de padding (p-3, p-4, px-3 py-2) que não significavam nada,
// só inconsistência acumulada. Consolidado em 2 tamanhos aqui.
//
// `role="alert"`/`role="status"` é novo: nenhuma dessas mensagens tinha uma
// role de live region — mesma lacuna de acessibilidade que o aria-live dos
// estados de CEP/Pix (achado P2), só que nestas o conteúdo já nasce visível
// no HTML (erro de validação de formulário, confirmação pós-submit), então
// a role sozinha já basta pra leitor de tela anunciar sem precisar de
// aria-live explícito.
export type AlertVariant = 'success' | 'danger' | 'warning'

const variantClass: Record<AlertVariant, string> = {
  success: 'text-green-700 bg-green-50 border-green-200',
  danger: 'text-red-600 bg-red-50 border-red-200',
  warning: 'text-amber-700 bg-amber-50 border-amber-200',
}

export type AlertProps = HTMLAttributes<HTMLParagraphElement> & {
  variant: AlertVariant
  size?: 'sm' | 'md'
  center?: boolean
  children: ReactNode
}

export default function Alert({ variant, size = 'md', center, className, children, ...rest }: AlertProps) {
  const cls = [
    'rounded-lg border',
    size === 'sm' ? 'text-xs p-3' : 'text-sm p-4',
    variantClass[variant],
    center ? 'text-center' : '',
    className ?? '',
  ]
    .filter(Boolean)
    .join(' ')
  return (
    <p role={variant === 'danger' ? 'alert' : 'status'} className={cls} {...rest}>
      {children}
    </p>
  )
}
