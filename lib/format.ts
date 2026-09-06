// Formatação/validação pequena reaproveitada em vários pontos do app —
// nada aqui depende de rede ou de outro módulo de domínio.

export function formatPrice(value: number): string {
  return `R$ ${Number(value).toFixed(2).replace('.', ',')}`
}

export function onlyDigits(value: string): string {
  return value.replace(/\D/g, '')
}

export function isValidZipCode(value: string): boolean {
  return onlyDigits(value).length === 8
}

export const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export function isValidUuid(value: string): boolean {
  return UUID_RE.test(value)
}
