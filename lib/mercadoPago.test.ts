import { describe, expect, it } from 'vitest'
import { normalizePaymentStatus, describeMercadoPagoPaymentMethod } from './mercadoPago'

describe('normalizePaymentStatus', () => {
  it('repassa os status conhecidos', () => {
    expect(normalizePaymentStatus('approved')).toBe('approved')
    expect(normalizePaymentStatus('rejected')).toBe('rejected')
    expect(normalizePaymentStatus('cancelled')).toBe('cancelled')
  })

  it('unifica refunded e charged_back em refunded', () => {
    expect(normalizePaymentStatus('refunded')).toBe('refunded')
    expect(normalizePaymentStatus('charged_back')).toBe('refunded')
  })

  it('qualquer outro status (in_process, pending, desconhecido) vira pending', () => {
    expect(normalizePaymentStatus('in_process')).toBe('pending')
    expect(normalizePaymentStatus('pending')).toBe('pending')
    expect(normalizePaymentStatus('algo_novo_que_o_mp_inventou')).toBe('pending')
  })
})

describe('describeMercadoPagoPaymentMethod', () => {
  it('traduz os tipos comuns pra PT-BR', () => {
    expect(describeMercadoPagoPaymentMethod({ payment_type_id: 'credit_card', payment_method_id: 'visa' })).toBe(
      'Cartão de crédito'
    )
    expect(describeMercadoPagoPaymentMethod({ payment_type_id: 'debit_card', payment_method_id: 'master' })).toBe(
      'Cartão de débito'
    )
    expect(describeMercadoPagoPaymentMethod({ payment_type_id: 'bank_transfer', payment_method_id: 'pix' })).toBe(
      'Pix'
    )
    expect(describeMercadoPagoPaymentMethod({ payment_type_id: 'ticket', payment_method_id: 'bolbradesco' })).toBe(
      'Boleto'
    )
  })

  it('cai pro payment_method_id cru quando o tipo não é um dos conhecidos', () => {
    expect(describeMercadoPagoPaymentMethod({ payment_type_id: 'account_money', payment_method_id: 'account_money' })).toBe(
      'account_money'
    )
  })

  it('devolve null quando não há nem tipo nem método', () => {
    expect(describeMercadoPagoPaymentMethod({ payment_type_id: null, payment_method_id: null })).toBeNull()
  })
})
