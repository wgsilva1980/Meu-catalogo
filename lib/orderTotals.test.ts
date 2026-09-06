import { describe, expect, it } from 'vitest'
import { orderDiscountAmount, orderTotal } from './orderTotals'

describe('orderDiscountAmount', () => {
  it('sem desconto (type nulo ou valor <= 0) devolve 0', () => {
    expect(orderDiscountAmount(100, null, 10)).toBe(0)
    expect(orderDiscountAmount(100, 'amount', 0)).toBe(0)
    expect(orderDiscountAmount(100, 'amount', -5)).toBe(0)
  })

  it('desconto percentual', () => {
    expect(orderDiscountAmount(200, 'percent', 10)).toBe(20)
  })

  it('desconto fixo', () => {
    expect(orderDiscountAmount(200, 'amount', 30)).toBe(30)
  })

  it('nunca passa do subtotal (não deixa o pedido negativo)', () => {
    expect(orderDiscountAmount(50, 'amount', 999)).toBe(50)
    expect(orderDiscountAmount(50, 'percent', 200)).toBe(50)
  })

  it('subtotal zero ou negativo devolve 0', () => {
    expect(orderDiscountAmount(0, 'amount', 10)).toBe(0)
  })
})

describe('orderTotal', () => {
  it('soma subtotal - desconto + frete', () => {
    const { discount, total } = orderTotal({
      itemsSubtotal: 200,
      discountType: 'percent',
      discountValue: 10,
      deliveryFee: 15,
    })
    expect(discount).toBe(20)
    expect(total).toBe(195)
  })

  it('sem desconto nem frete', () => {
    const { discount, total } = orderTotal({
      itemsSubtotal: 100,
      discountType: null,
      discountValue: null,
      deliveryFee: 0,
    })
    expect(discount).toBe(0)
    expect(total).toBe(100)
  })

  it('nunca fica negativo mesmo com desconto maior que o subtotal', () => {
    const { total } = orderTotal({
      itemsSubtotal: 50,
      discountType: 'amount',
      discountValue: 500,
      deliveryFee: 0,
    })
    expect(total).toBe(0)
  })
})
