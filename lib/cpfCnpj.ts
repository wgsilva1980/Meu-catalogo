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
  const calcCheck = (nums: number[]) => {
    let weight = nums.length - 7
    let sum = 0
    for (let i = nums.length - 1; i >= 0; i--) {
      sum += nums[i] * weight
      weight = weight === 2 ? 9 : weight - 1
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
