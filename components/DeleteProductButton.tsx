'use client'

import { useState, useTransition } from 'react'
import { TrashIcon } from '@/components/icons'
import type { DeleteProductResult } from '@/app/admin/produtos/actions'

// Mesmo padrão de components/DeleteOrderButton.tsx: confirma antes de excluir
// (irreversível) e mostra que o produto está sendo excluído enquanto a
// action roda, em vez do form puro de antes que apagava no primeiro clique.
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

  const handleClick = () => {
    if (!window.confirm(`Excluir o produto "${productName}"? Essa ação não pode ser desfeita.`)) return
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
      <button
        type="button"
        onClick={handleClick}
        disabled={isPending}
        title="Excluir produto"
        className="inline-flex items-center gap-1 rounded-md border border-line px-2.5 py-1.5 text-xs font-semibold text-red-600 hover:bg-red-50 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        <TrashIcon className="w-3.5 h-3.5" />
        {isPending ? 'Excluindo…' : 'Excluir'}
      </button>
      {error && <p className="text-xs text-red-600 max-w-[16rem] text-right">{error}</p>}
    </div>
  )
}
