'use client'

import { useState, useTransition } from 'react'
import { TrashIcon } from '@/components/icons'
import Button from '@/components/Button'
import type { DeleteOrderResult } from '@/app/admin/pedidos/actions'

// Confirma antes de excluir (irreversível) e mostra que o pedido está sendo
// excluído enquanto a action roda — chama a server action direto (fora de
// um <form>) pra poder gatear com window.confirm antes de disparar.
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

  const handleClick = () => {
    if (!window.confirm(`Excluir o pedido #${orderNumber}? Essa ação não pode ser desfeita.`)) return
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
        onClick={handleClick}
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
    </div>
  )
}
