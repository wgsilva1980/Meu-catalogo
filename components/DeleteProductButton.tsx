'use client'

import { useState, useTransition } from 'react'
import { TrashIcon } from '@/components/icons'
import Button from '@/components/Button'
import Modal from '@/components/Modal'
import type { DeleteProductResult } from '@/app/admin/produtos/actions'

// Mesmo padrão de components/DeleteOrderButton.tsx: confirma antes de excluir
// (irreversível) por um Modal (era window.confirm() nativo até o achado P1
// da "Raio-X do Catálogo II") e mostra que o produto está sendo excluído
// enquanto a action roda.
export default function DeleteProductButton({
  productId,
  productName,
  deleteProduct,
}: {
  productId: string
  productName: string
  deleteProduct: (formData: FormData) => Promise<DeleteProductResult>
}) {
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [confirmOpen, setConfirmOpen] = useState(false)

  function handleConfirm() {
    setConfirmOpen(false)
    setError(null)
    const formData = new FormData()
    formData.set('id', productId)
    startTransition(async () => {
      const result = await deleteProduct(formData)
      if (!result.ok) setError(result.error)
    })
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <Button
        type="button"
        onClick={() => setConfirmOpen(true)}
        disabled={isPending}
        title="Excluir produto"
        variant="danger"
        size="sm"
        className="disabled:cursor-not-allowed"
      >
        <TrashIcon className="w-3.5 h-3.5" />
        {isPending ? 'Excluindo…' : 'Excluir'}
      </Button>
      {error && <p className="text-xs text-danger max-w-[16rem] text-right">{error}</p>}

      <Modal
        open={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        title="Excluir produto?"
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
        Excluir o produto &quot;{productName}&quot;? Essa ação não pode ser desfeita.
      </Modal>
    </div>
  )
}
