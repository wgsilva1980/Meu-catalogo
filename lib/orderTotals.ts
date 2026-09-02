import type { DiscountType } from '@/lib/types'

// Só matemática — pode ser usado tanto no servidor quanto no client.

function round2(n: number) {
  return Math.round(n * 100) / 100
}

// Valor do desconto em reais, dado o subtotal dos produtos. Nunca passa do
// subtotal (não deixa o pedido negativo) nem fica negativo.
export function orderDiscountAmount(
  itemsSubtotal: number,
  type: DiscountType | null | undefined,
  value: number | null | undefined
): number {
  const v = Number(value) || 0
  if (!type || v <= 0 || itemsSubtotal <= 0) return 0
  const raw = type === 'percent' ? itemsSubtotal * (v / 100) : v
  return round2(Math.min(Math.max(raw, 0), itemsSubtotal))
}

// Total do pedido: (subtotal dos itens − desconto) + frete.
export function orderTotal({
  itemsSubtotal,
  discountType,
  discountValue,
  deliveryFee,
}: {
  itemsSubtotal: number
  discountType: DiscountType | null | undefined
  discountValue: number | null | undefined
  deliveryFee: number
}): { discount: number; total: number } {
  const discount = orderDiscountAmount(itemsSubtotal, discountType, discountValue)
  const total = round2(Math.max(itemsSubtotal - discount, 0) + (Number(deliveryFee) || 0))
  return { discount, total }
}
