// Helpers para os formulários públicos (cadastro de cliente e pedido), que
// rodam sem autenticação com o client admin. Limitam o tamanho dos campos
// para evitar inserção de registros gigantes e escapam texto que vai para
// dentro de e-mails HTML de notificação.

export const FIELD_LIMITS = {
  name: 120,
  phone: 40,
  email: 160,
  document: 40,
  zip_code: 12,
  street: 160,
  number: 20,
  complement: 120,
  neighborhood: 120,
  city: 120,
  state: 40,
  notes: 2000,
} as const

export function readField(
  formData: FormData,
  name: keyof typeof FIELD_LIMITS
): string | null {
  const raw = formData.get(name)
  if (typeof raw !== 'string') return null
  const trimmed = raw.trim().slice(0, FIELD_LIMITS[name])
  return trimmed || null
}

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

// Campo isca: bots preenchem tudo; humanos não veem o input. Se vier
// preenchido, tratamos como spam.
export function isBot(formData: FormData): boolean {
  const trap = formData.get('company_website')
  return typeof trap === 'string' && trap.trim().length > 0
}
