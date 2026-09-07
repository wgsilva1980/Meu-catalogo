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

// Endereço numa linha só ("Rua X, 10 - Apto 2 · Bairro · Cidade - UF · CEP
// 00000-000"). Campos como `unknown` porque um dos dois chamadores lê de um
// `Record<string, unknown>` (endereço vindo do formData) — nunca formatação
// de dado sensível, só concatena o que tiver.
export function formatAddress(addr: {
  street?: unknown
  number?: unknown
  complement?: unknown
  neighborhood?: unknown
  city?: unknown
  state?: unknown
  zip_code?: unknown
}): string {
  return [
    [addr.street, addr.number].filter(Boolean).join(', ') + (addr.complement ? ` - ${addr.complement}` : ''),
    addr.neighborhood,
    [addr.city, addr.state].filter(Boolean).join(' - '),
    addr.zip_code ? `CEP ${addr.zip_code}` : null,
  ]
    .filter(Boolean)
    .join(' · ')
}
