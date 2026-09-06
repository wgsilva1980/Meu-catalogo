import { describe, expect, it } from 'vitest'
import { formatPrice, onlyDigits, isValidZipCode, isValidUuid, UUID_RE } from './format'

describe('formatPrice', () => {
  it('formata em reais com vírgula decimal', () => {
    expect(formatPrice(1234.5)).toBe('R$ 1234,50')
    expect(formatPrice(0)).toBe('R$ 0,00')
  })

  it('arredonda pra 2 casas', () => {
    expect(formatPrice(9.999)).toBe('R$ 10,00')
  })
})

describe('onlyDigits', () => {
  it('remove tudo que não é dígito', () => {
    expect(onlyDigits('12.345-678')).toBe('12345678')
    expect(onlyDigits('(11) 91234-5678')).toBe('11912345678')
    expect(onlyDigits('')).toBe('')
  })
})

describe('isValidZipCode', () => {
  it('aceita CEP com 8 dígitos, com ou sem máscara', () => {
    expect(isValidZipCode('12345-678')).toBe(true)
    expect(isValidZipCode('12345678')).toBe(true)
  })

  it('rejeita tamanho errado', () => {
    expect(isValidZipCode('1234-567')).toBe(false)
    expect(isValidZipCode('')).toBe(false)
  })
})

describe('isValidUuid / UUID_RE', () => {
  it('aceita UUID v4 válido, maiúsculo ou minúsculo', () => {
    expect(isValidUuid('74aa5884-727e-4961-a88a-65ee627b6d67')).toBe(true)
    expect(isValidUuid('74AA5884-727E-4961-A88A-65EE627B6D67')).toBe(true)
  })

  it('rejeita string que não é UUID', () => {
    expect(isValidUuid('não-é-um-uuid')).toBe(false)
    expect(isValidUuid('74aa5884-727e-4961-a88a')).toBe(false)
  })

  it('UUID_RE exportado casa com o mesmo padrão', () => {
    expect(UUID_RE.test('74aa5884-727e-4961-a88a-65ee627b6d67')).toBe(true)
  })
})
