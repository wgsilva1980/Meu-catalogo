import { describe, expect, it } from 'vitest'
import { pickShippingBox } from './melhorEnvio'
import type { ShippingBox } from './types'

const box = (overrides: Partial<ShippingBox> & Pick<ShippingBox, 'name'>): ShippingBox => ({
  length_cm: 20,
  width_cm: 20,
  height_cm: 20,
  max_weight_kg: null,
  ...overrides,
})

describe('pickShippingBox', () => {
  it('devolve null quando não há caixa cadastrada', () => {
    expect(pickShippingBox([], [{ length_cm: 1, width_cm: 1, height_cm: 1, weight_kg: 0.1, quantity: 1 }])).toBeNull()
  })

  it('escolhe a única caixa quando o item cabe', () => {
    const p = box({ name: 'P', length_cm: 30, width_cm: 20, height_cm: 10, max_weight_kg: 5 })
    const result = pickShippingBox([p], [{ length_cm: 10, width_cm: 10, height_cm: 5, weight_kg: 0.5, quantity: 1 }])
    expect(result).toEqual({ box: p, fits: true })
  })

  it('escolhe a menor caixa (por volume) entre as que servem', () => {
    const small = box({ name: 'P', length_cm: 20, width_cm: 15, height_cm: 10 })
    const big = box({ name: 'G', length_cm: 40, width_cm: 30, height_cm: 20 })
    const result = pickShippingBox(
      [big, small],
      [{ length_cm: 15, width_cm: 10, height_cm: 8, weight_kg: 1, quantity: 1 }]
    )
    expect(result).toEqual({ box: small, fits: true })
  })

  it('nenhuma caixa comporta as dimensões: devolve a maior com fits: false', () => {
    const small = box({ name: 'P', length_cm: 10, width_cm: 10, height_cm: 10 })
    const big = box({ name: 'G', length_cm: 20, width_cm: 20, height_cm: 20 })
    const result = pickShippingBox(
      [small, big],
      [{ length_cm: 25, width_cm: 25, height_cm: 25, weight_kg: 1, quantity: 1 }]
    )
    expect(result).toEqual({ box: big, fits: false })
  })

  it('pula caixa cujo peso máximo estoura, mesmo cabendo em dimensão', () => {
    const light = box({ name: 'Leve', length_cm: 20, width_cm: 20, height_cm: 20, max_weight_kg: 1 })
    const heavy = box({ name: 'Pesada', length_cm: 30, width_cm: 30, height_cm: 30, max_weight_kg: null })
    const result = pickShippingBox(
      [light, heavy],
      [{ length_cm: 15, width_cm: 15, height_cm: 15, weight_kg: 5, quantity: 1 }]
    )
    expect(result).toEqual({ box: heavy, fits: true })
  })

  it('rejeita caixa quando o volume somado passa de 80% mesmo cabendo item a item', () => {
    const p = box({ name: 'P', length_cm: 10, width_cm: 10, height_cm: 10 })
    // 3 unidades de 10x10x5 = 1500cm³, > 80% dos 1000cm³ da caixa (800cm³),
    // mesmo cada unidade cabendo perfeitamente sozinha.
    const result = pickShippingBox(
      [p],
      [{ length_cm: 10, width_cm: 10, height_cm: 5, weight_kg: 0.1, quantity: 3 }]
    )
    expect(result).toEqual({ box: p, fits: false })
  })
})
