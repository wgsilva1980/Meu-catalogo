'use client'

import { useState, useTransition } from 'react'
import { TrashIcon } from '@/components/icons'
import Button from '@/components/Button'
import Modal from '@/components/Modal'
import type { DeleteOrderResult } from '@/app/admin/pedidos/actions'

// Confirma antes de excluir (irreversível) e mostra que o pedido está sendo
// excluído enquanto a action roda — chama a server action direto (fora de
// um <form>) pra poder gatear com um Modal antes de disparar. Era
// window.confirm() nativo do navegador até a "Raio-X do Catálogo II"
// (achado P1) apontar que era a única caixa de diálogo do produto sem
// nenhuma marca.
export default function DeleteOrderButton({
  orderId,
  orderNumber,
  disabledReason,
  deleteOrder,
}: {
  orderId: string
  orderNumber: number
  disabledReason: string | null
  deleteOrder: (formData: FormData) => Promise<DeleteOrderResult>
}) {
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [confirmOpen, setConfirmOpen] = useState(false)

  function handleConfirm() {
    setConfirmOpen(false)
    setError(null)
    const formData = new FormData()
    formData.set('id', orderId)
    startTransition(async () => {
      const result = await deleteOrder(formData)
      if (!result.ok) setError(result.error)
    })
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <Button
        type="button"
        onClick={() => setConfirmOpen(true)}
        disabled={isPending || Boolean(disabledReason)}
        title={disabledReason ?? 'Excluir pedido'}
        variant="danger"
        size="sm"
        className="disabled:hover:bg-transparent disabled:cursor-not-allowed"
      >
        <TrashIcon className="w-3.5 h-3.5" />
        {isPending ? 'Excluindo…' : 'Excluir'}
      </Button>
      {error && <p className="text-xs text-danger max-w-[16rem] text-right">{error}</p>}

      <Modal
        open={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        title="Excluir pedido?"
        actions={
          <>
            <Button type="button" variant="secondary" size="sm" onClick={() => setConfirmOpen(false)}>
              Cancelar
            </Button>
            <Button type="button" variant="danger" size="sm" onClick={handleConfirm}>
              Excluir
            </Button>
          </>
        }
      >
        Excluir o pedido #{orderNumber}? Essa ação não pode ser desfeita.
      </Modal>
    </div>
  )
}
