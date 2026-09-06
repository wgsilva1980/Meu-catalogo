// Validação de CPF/CNPJ pelo dígito verificador oficial — evita salvar
// documentos com formato certo mas número inventado (ex.: 111.111.111-11).

export function isValidCPF(value: string): boolean {
  const cpf = value.replace(/\D/g, '')
  if (cpf.length !== 11 || /^(\d)\1{10}$/.test(cpf)) return false

  let sum = 0
  for (let i = 0; i < 9; i++) sum += Number(cpf[i]) * (10 - i)
  let check = (sum * 10) % 11
  if (check === 10) check = 0
  if (check !== Number(cpf[9])) return false

  sum = 0
  for (let i = 0; i < 10; i++) sum += Number(cpf[i]) * (11 - i)
  check = (sum * 10) % 11
  if (check === 10) check = 0
  if (check !== Number(cpf[10])) return false

  return true
}

export function isValidCNPJ(value: string): boolean {
  const cnpj = value.replace(/\D/g, '')
  if (cnpj.length !== 14 || /^(\d)\1{13}$/.test(cnpj)) return false

  const digits = cnpj.slice(0, 12).split('').map(Number)
  // Peso 2 pro último dígito, crescendo pra esquerda e voltando a 2 depois
  // do 9 — dá 5,4,3,2,9,8,7,6,5,4,3,2 pros 12 dígitos base (confirmado à
  // mão contra CNPJs reais). A versão anterior começava em `nums.length - 7`
  // e decrescia, o que aplicava essa mesma sequência de pesos de trás pra
  // frente — rejeitava quase todo CNPJ válido.
  const calcCheck = (nums: number[]) => {
    let weight = 2
    let sum = 0
    for (let i = nums.length - 1; i >= 0; i--) {
      sum += nums[i] * weight
      weight = weight === 9 ? 2 : weight + 1
    }
    const rest = sum % 11
    return rest < 2 ? 0 : 11 - rest
  }

  const firstCheck = calcCheck(digits)
  if (firstCheck !== Number(cnpj[12])) return false
  const secondCheck = calcCheck([...digits, firstCheck])
  if (secondCheck !== Number(cnpj[13])) return false

  return true
}

// Campo é opcional: string vazia/só espaços é válida (nada para checar).
export function isValidCpfCnpj(value: string | null | undefined): boolean {
  const digits = (value ?? '').replace(/\D/g, '')
  if (!digits) return true
  if (digits.length === 11) return isValidCPF(digits)
  if (digits.length === 14) return isValidCNPJ(digits)
  return false
}

// Formato que a API de pagamentos do Mercado Pago espera em `payer.identification`.
// Nunca repassa um documento com dígito verificador inválido.
export function toMercadoPagoIdentification(value: string | null | undefined): { type: 'CPF' | 'CNPJ'; number: string } | null {
  const digits = (value ?? '').replace(/\D/g, '')
  if (digits.length === 11 && isValidCPF(digits)) return { type: 'CPF', number: digits }
  if (digits.length === 14 && isValidCNPJ(digits)) return { type: 'CNPJ', number: digits }
  return null
}
