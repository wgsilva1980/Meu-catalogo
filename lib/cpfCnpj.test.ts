import { describe, expect, it } from 'vitest'
import { isValidCPF, isValidCNPJ, isValidCpfCnpj, toMercadoPagoIdentification } from './cpfCnpj'

// Regressão do bug real: os pesos do dígito verificador do CNPJ estavam
// invertidos (lib/cpfCnpj.ts) e rejeitavam ~99% dos CNPJs válidos — inclusive
// todos os CNPJs reais abaixo. Ver a análise em MERCADO_PAGO_CHECKOUT_TRANSPARENTE.md.
describe('isValidCNPJ', () => {
  it('aceita CNPJs reais conhecidos', () => {
    expect(isValidCNPJ('11.222.333/0001-81')).toBe(true)
    expect(isValidCNPJ('33.000.167/0001-01')).toBe(true) // Petrobras
    expect(isValidCNPJ('60.746.948/0001-12')).toBe(true) // Bradesco
    expect(isValidCNPJ('00.000.000/0001-91')).toBe(true)
    expect(isValidCNPJ('07.526.557/0001-00')).toBe(true)
  })

  it('rejeita dígito verificador errado', () => {
    expect(isValidCNPJ('11.222.333/0001-80')).toBe(false)
    expect(isValidCNPJ('11.222.333/0001-00')).toBe(false)
  })

  it('rejeita todos os dígitos iguais', () => {
    expect(isValidCNPJ('11.111.111/1111-11')).toBe(false)
    expect(isValidCNPJ('00.000.000/0000-00')).toBe(false)
  })

  it('rejeita tamanho errado', () => {
    expect(isValidCNPJ('123')).toBe(false)
    expect(isValidCNPJ('')).toBe(false)
  })

  it('aceita só com os dígitos (sem máscara)', () => {
    expect(isValidCNPJ('11222333000181')).toBe(true)
  })
})

describe('isValidCPF', () => {
  it('aceita CPFs válidos', () => {
    expect(isValidCPF('529.982.247-25')).toBe(true)
    expect(isValidCPF('52998224725')).toBe(true)
  })

  it('rejeita dígito verificador errado', () => {
    expect(isValidCPF('529.982.247-00')).toBe(false)
  })

  it('rejeita todos os dígitos iguais', () => {
    expect(isValidCPF('111.111.111-11')).toBe(false)
  })

  it('rejeita tamanho errado', () => {
    expect(isValidCPF('123')).toBe(false)
  })
})

describe('isValidCpfCnpj', () => {
  it('aceita vazio/nulo — documento é opcional', () => {
    expect(isValidCpfCnpj(null)).toBe(true)
    expect(isValidCpfCnpj(undefined)).toBe(true)
    expect(isValidCpfCnpj('')).toBe(true)
    expect(isValidCpfCnpj('   ')).toBe(true)
  })

  it('valida CPF (11 dígitos) e CNPJ (14 dígitos) pelo tamanho', () => {
    expect(isValidCpfCnpj('529.982.247-25')).toBe(true)
    expect(isValidCpfCnpj('11.222.333/0001-81')).toBe(true)
  })

  it('rejeita tamanho que não é nem CPF nem CNPJ', () => {
    expect(isValidCpfCnpj('123456')).toBe(false)
  })
})

describe('toMercadoPagoIdentification', () => {
  it('devolve type/number pra CPF válido', () => {
    expect(toMercadoPagoIdentification('529.982.247-25')).toEqual({ type: 'CPF', number: '52998224725' })
  })

  it('devolve type/number pra CNPJ válido', () => {
    expect(toMercadoPagoIdentification('11.222.333/0001-81')).toEqual({ type: 'CNPJ', number: '11222333000181' })
  })

  it('devolve null pra documento inválido ou ausente', () => {
    expect(toMercadoPagoIdentification('11.222.333/0001-00')).toBeNull()
    expect(toMercadoPagoIdentification(null)).toBeNull()
    expect(toMercadoPagoIdentification('')).toBeNull()
  })
})
