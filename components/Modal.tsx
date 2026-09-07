'use client'

import { useEffect, useId, useRef, type ReactNode } from 'react'

// 5º componente do design system, depois de Button/Card/Badge/Alert — as
// duas únicas confirmações destrutivas do produto (excluir pedido, excluir
// produto) usavam window.confirm() nativo do navegador: a única caixa de
// diálogo do produto inteiro sem nenhuma marca, bem na ação mais sensível
// do painel. Ver "Raio-X do Catálogo II", achado P1.
export type ModalProps = {
  open: boolean
  onClose: () => void
  title: string
  children: ReactNode
  actions: ReactNode
}

export default function Modal({ open, onClose, title, children, actions }: ModalProps) {
  const panelRef = useRef<HTMLDivElement>(null)
  const titleId = useId()

  useEffect(() => {
    if (!open) return

    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handleKey)

    // Foco vai pro painel assim que abre, pra teclado/leitor de tela
    // começarem dali em vez de ficarem presos no botão que abriu o modal.
    panelRef.current?.focus()

    return () => document.removeEventListener('keydown', handleKey)
  }, [open, onClose])

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-ink/40"
      onClick={onClose}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-sm bg-surface border border-line rounded-2xl p-5 flex flex-col gap-3 shadow-lg outline-none"
      >
        <h2 id={titleId} className="text-sm font-bold">
          {title}
        </h2>
        <div className="text-sm text-muted">{children}</div>
        <div className="flex justify-end gap-2 mt-2">{actions}</div>
      </div>
    </div>
  )
}
