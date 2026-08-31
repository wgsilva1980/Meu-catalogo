// Cliente para a API do Melhor Envio (https://docs.melhorenvio.com.br).
// Um único app (client_id/secret em env vars) é compartilhado pela
// plataforma; cada empresa conecta e guarda seu próprio token em
// `melhor_envio_accounts`. Nunca importar em código client — usa a service
// role para ler/gravar tokens, que não passam pelo navegador do usuário.
import { createAdminClient } from '@/lib/supabase/admin'
import type { MelhorEnvioEnvironment, ShippingBox } from '@/lib/types'

const BASE_URL: Record<MelhorEnvioEnvironment, string> = {
  sandbox: 'https://sandbox.melhorenvio.com.br',
  production: 'https://melhorenvio.com.br',
}

export const OAUTH_STATE_COOKIE = 'melhor_envio_oauth_state'

export function melhorEnvioEnvironment(): MelhorEnvioEnvironment {
  return process.env.MELHOR_ENVIO_ENVIRONMENT === 'production' ? 'production' : 'sandbox'
}

function baseUrl(environment: MelhorEnvioEnvironment) {
  return BASE_URL[environment]
}

function userAgent() {
  return process.env.MELHOR_ENVIO_USER_AGENT || 'Meu Catalogo (wagnergarnizet@gmail.com)'
}

export function getAuthorizeUrl({ redirectUri, state }: { redirectUri: string; state: string }) {
  const environment = melhorEnvioEnvironment()
  const clientId = process.env.MELHOR_ENVIO_CLIENT_ID?.trim()
  if (!clientId) throw new Error('MELHOR_ENVIO_CLIENT_ID não configurada')

  const scopes = [
    'shipping-calculate',
    'cart-write',
    'shipping-checkout',
    'shipping-generate',
    'shipping-print',
    'shipping-tracking',
    'shipping-companies',
  ]

  const url = new URL(`${baseUrl(environment)}/oauth/authorize`)
  url.searchParams.set('client_id', clientId)
  url.searchParams.set('redirect_uri', redirectUri)
  url.searchParams.set('response_type', 'code')
  url.searchParams.set('scope', scopes.join(' '))
  url.searchParams.set('state', state)
  return url.toString()
}

type TokenResponse = {
  access_token: string
  refresh_token: string
  expires_in: number
  token_type: string
}

async function requestToken(environment: MelhorEnvioEnvironment, body: Record<string, string>) {
  const clientId = process.env.MELHOR_ENVIO_CLIENT_ID?.trim()
  const clientSecret = process.env.MELHOR_ENVIO_CLIENT_SECRET?.trim()
  if (!clientId || !clientSecret) throw new Error('Credenciais do Melhor Envio não configuradas')

  // Diferente do resto da API (que usa JSON), a rota OAuth2 de token espera
  // o corpo como application/x-www-form-urlencoded — enviar JSON aqui faz o
  // servidor não enxergar client_id/client_secret e responder "invalid_client".
  const form = new URLSearchParams({ ...body, client_id: clientId, client_secret: clientSecret })
  const res = await fetch(`${baseUrl(environment)}/oauth/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json' },
    body: form.toString(),
  })
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    // Inclui o client_id (nunca o secret) usado nesta troca — essa chamada
    // acontece no servidor, então é a única forma de confirmar pela própria
    // mensagem de erro (sem acesso aos logs do Vercel) qual credencial foi
    // realmente lida do ambiente no momento da falha.
    throw new Error(
      `Falha ao obter token do Melhor Envio (${res.status}) [ambiente: ${environment}, client_id usado: ${clientId}, redirect_uri usado: ${body.redirect_uri ?? '(n/a)'}]: ${text}`
    )
  }
  return (await res.json()) as TokenResponse
}

// Troca o código de autorização (retornado no callback) pelo par de tokens
// e já grava a conta da empresa.
export async function connectAccount({
  companyId,
  code,
  redirectUri,
}: {
  companyId: string
  code: string
  redirectUri: string
}) {
  const environment = melhorEnvioEnvironment()
  const token = await requestToken(environment, {
    grant_type: 'authorization_code',
    redirect_uri: redirectUri,
    code,
  })

  const admin = createAdminClient()
  await admin.from('melhor_envio_accounts').upsert({
    company_id: companyId,
    environment,
    access_token: token.access_token,
    refresh_token: token.refresh_token,
    expires_at: new Date(Date.now() + token.expires_in * 1000).toISOString(),
  })
}

export async function disconnectAccount(companyId: string) {
  const admin = createAdminClient()
  await admin.from('melhor_envio_accounts').delete().eq('company_id', companyId)
}

// Retorna um access_token válido para a empresa, renovando via
// refresh_token quando estiver perto de expirar. null se a empresa nunca
// conectou (ou desconectou) a conta.
export async function getValidAccessToken(companyId: string): Promise<string | null> {
  const admin = createAdminClient()
  const { data: account } = await admin
    .from('melhor_envio_accounts')
    .select('*')
    .eq('company_id', companyId)
    .maybeSingle()
  if (!account) return null

  const expiresInMs = new Date(account.expires_at).getTime() - Date.now()
  if (expiresInMs > 5 * 60 * 1000) return account.access_token

  try {
    const token = await requestToken(account.environment, {
      grant_type: 'refresh_token',
      refresh_token: account.refresh_token,
    })
    await admin
      .from('melhor_envio_accounts')
      .update({
        access_token: token.access_token,
        refresh_token: token.refresh_token,
        expires_at: new Date(Date.now() + token.expires_in * 1000).toISOString(),
      })
      .eq('company_id', companyId)
    return token.access_token
  } catch (err) {
    console.error('Falha ao renovar token do Melhor Envio:', err)
    // token antigo ainda pode funcionar por uma margem curta mesmo "vencido"
    // no nosso relógio; deixa a chamada seguinte falhar explicitamente se não.
    return account.access_token
  }
}

type MelhorEnvioRequestOptions = {
  companyId: string
  method: 'GET' | 'POST'
  path: string
  body?: unknown
}

async function melhorEnvioRequest<T>({ companyId, method, path, body }: MelhorEnvioRequestOptions): Promise<T> {
  const accessToken = await getValidAccessToken(companyId)
  if (!accessToken) throw new Error('Empresa não conectou a conta do Melhor Envio')

  const admin = createAdminClient()
  const { data: account } = await admin
    .from('melhor_envio_accounts')
    .select('environment')
    .eq('company_id', companyId)
    .single()
  const environment = account?.environment ?? melhorEnvioEnvironment()

  const res = await fetch(`${baseUrl(environment)}${path}`, {
    method,
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken}`,
      'User-Agent': userAgent(),
    },
    body: body ? JSON.stringify(body) : undefined,
  })

  const text = await res.text()
  let data: unknown = null
  try {
    data = text ? JSON.parse(text) : null
  } catch {
    data = text
  }

  if (!res.ok) {
    console.error('Erro na API do Melhor Envio:', path, res.status, data)
    // Inclui o corpo da resposta (mensagem/erros de validação) na própria
    // exceção — essas chamadas rodam no servidor, então sem isso o usuário só
    // vê "erro (422)" sem saber qual campo a API rejeitou.
    const detail = typeof data === 'string' ? data : JSON.stringify(data)
    throw new Error(`Melhor Envio retornou erro (${res.status}) em ${path}: ${detail}`)
  }
  return data as T
}

export type ShippingCarrier = { id: number; name: string }

// Transportadoras disponíveis na conta do Melhor Envio da empresa, para o
// seletor de transportadora do combo de agências nas Configurações.
export async function listShippingCarriers({ companyId }: { companyId: string }): Promise<ShippingCarrier[]> {
  const carriers = await melhorEnvioRequest<Array<{ id: number; name: string }>>({
    companyId,
    method: 'GET',
    path: '/api/v2/me/shipment/companies',
  })
  return (carriers ?? []).map((c) => ({ id: c.id, name: c.name }))
}

export type ShippingAgency = { id: number; name: string; city: string }

// Agências de postagem de uma transportadora para o combo de "Agência de
// postagem" nas Configurações. Filtra por CEP (mais preciso, retorna as
// mais próximas) e/ou UF.
export async function listShippingAgencies({
  companyId,
  carrierCompanyId,
  state,
  postalCode,
}: {
  companyId: string
  carrierCompanyId: number
  state?: string
  postalCode?: string
}): Promise<ShippingAgency[]> {
  const query = new URLSearchParams({ company: String(carrierCompanyId), country: 'BR' })
  if (postalCode) query.set('postal_code', postalCode)
  if (state) query.set('state', state)
  const agencies = await melhorEnvioRequest<
    Array<{ id: number; name: string; address?: { city?: { city?: string } } }>
  >({
    companyId,
    method: 'GET',
    path: `/api/v2/me/shipment/agencies?${query.toString()}`,
  })
  return (agencies ?? []).map((a) => ({ id: a.id, name: a.name, city: a.address?.city?.city ?? '' }))
}

export type ShippingQuoteItem = {
  weight_kg: number
  quantity: number
  insurance_value: number
  // Só usados na compra (não no cálculo): a API do Melhor Envio exige a
  // lista de produtos no carrinho sempre que há declaração de conteúdo
  // (isto é, sempre que insurance_value > 0), senão o /api/v2/me/cart
  // responde 422 pedindo "products".
  name?: string
  unit_value?: number
}

// Caixa escolhida para o pedido (cm). Todos os itens viajam numa única
// caixa com estas dimensões e o peso somado dos produtos, gerando uma
// etiqueta só.
export type ShippingPackage = {
  length_cm: number
  width_cm: number
  height_cm: number
}

// Produto com dimensões, usado só para escolher a caixa.
export type PackableItem = {
  length_cm: number
  width_cm: number
  height_cm: number
  weight_kg: number
  quantity: number
}

// Folga de empacotamento: nunca se aproveita 100% do volume interno de uma
// caixa, então exigimos que o volume somado dos produtos caiba em 80% dela.
const BOX_FILL_FACTOR = 0.8

function sortedDims(l: number, w: number, h: number) {
  return [l, w, h].sort((a, b) => a - b)
}

function boxVolume(box: ShippingBox) {
  return box.length_cm * box.width_cm * box.height_cm
}

// Escolhe a menor caixa (por volume) em que o pedido caiba:
//  - cada produto, na melhor orientação, cabe dentro da caixa;
//  - o volume somado dos produtos <= volume interno da caixa * BOX_FILL_FACTOR;
//  - o peso total respeita max_weight_kg da caixa, se informado.
// Se nenhuma caixa serve, devolve a maior com `fits: false` (a UI avisa e o
// admin pode trocar). Retorna null quando não há caixa cadastrada.
export function pickShippingBox(
  boxes: ShippingBox[],
  items: PackableItem[]
): { box: ShippingBox; fits: boolean } | null {
  if (boxes.length === 0) return null

  const totalWeight = items.reduce((sum, i) => sum + i.weight_kg * i.quantity, 0)
  const totalVolume = items.reduce((sum, i) => sum + i.length_cm * i.width_cm * i.height_cm * i.quantity, 0)
  const itemDims = items.map((i) => sortedDims(i.length_cm, i.width_cm, i.height_cm))

  const byVolume = [...boxes].sort((a, b) => boxVolume(a) - boxVolume(b))

  for (const box of byVolume) {
    const bd = sortedDims(box.length_cm, box.width_cm, box.height_cm)
    const everyItemFits = itemDims.every((d) => d[0] <= bd[0] && d[1] <= bd[1] && d[2] <= bd[2])
    const volumeOk = totalVolume <= boxVolume(box) * BOX_FILL_FACTOR
    const weightOk = box.max_weight_kg == null || totalWeight <= box.max_weight_kg
    if (everyItemFits && volumeOk && weightOk) return { box, fits: true }
  }

  return { box: byVolume[byVolume.length - 1], fits: false }
}

// Lista de caixas da loja, com fallback para a caixa padrão única (legado)
// enquanto a loja não cadastra a lista.
export function resolveShippingBoxes(company: {
  shipping_packages?: ShippingBox[] | null
  shipping_package_length_cm?: number | null
  shipping_package_width_cm?: number | null
  shipping_package_height_cm?: number | null
}): ShippingBox[] {
  const list = Array.isArray(company.shipping_packages) ? company.shipping_packages : []
  if (list.length > 0) return list
  if (company.shipping_package_length_cm && company.shipping_package_width_cm && company.shipping_package_height_cm) {
    return [
      {
        name: 'Caixa padrão',
        length_cm: Number(company.shipping_package_length_cm),
        width_cm: Number(company.shipping_package_width_cm),
        height_cm: Number(company.shipping_package_height_cm),
        max_weight_kg: null,
      },
    ]
  }
  return []
}

// Peso total do pedido (kg), somando quantidade de cada item, com o piso de
// 0.01kg do Melhor Envio aplicado ao total.
function totalWeightKg(items: ShippingQuoteItem[]) {
  return clampPackageWeight(items.reduce((sum, item) => sum + item.weight_kg * item.quantity, 0))
}

function totalInsuranceValue(items: ShippingQuoteItem[]) {
  return items.reduce((sum, item) => sum + item.insurance_value, 0)
}

export type ShippingQuoteOption = {
  id: number
  name: string
  price: string
  delivery_time: number
  company: { id: number; name: string; picture: string }
  error?: string
}

export async function calculateShipping({
  companyId,
  fromPostalCode,
  toPostalCode,
  items,
  packageBox,
  carrierCompanyId,
}: {
  companyId: string
  fromPostalCode: string
  toPostalCode: string
  items: ShippingQuoteItem[]
  packageBox: ShippingPackage
  // Quando definido, só devolve cotações desta transportadora (o `company.id`
  // do Melhor Envio). É a transportadora padrão configurada pela loja.
  carrierCompanyId?: number | null
}) {
  // Uma caixa só: dimensões da caixa padrão, peso e seguro somados do pedido.
  // O cálculo precisa bater com o que a compra vai enviar em /api/v2/me/cart.
  const options = await melhorEnvioRequest<ShippingQuoteOption[]>({
    companyId,
    method: 'POST',
    path: '/api/v2/me/shipment/calculate',
    body: {
      from: { postal_code: onlyDigits(fromPostalCode) },
      to: { postal_code: onlyDigits(toPostalCode) },
      products: [
        {
          id: 'order',
          width: packageBox.width_cm,
          height: packageBox.height_cm,
          length: packageBox.length_cm,
          weight: totalWeightKg(items),
          insurance_value: totalInsuranceValue(items),
          quantity: 1,
        },
      ],
    },
  })
  // a API retorna também as opções sem cotação (ex: agência não atende a
  // região) com um campo "error" — só interessam as que têm preço.
  const priced = options.filter((option) => !option.error && option.price)
  if (carrierCompanyId == null) return priced
  return priced.filter((option) => option.company?.id === carrierCompanyId)
}

export type ShippingAddress = {
  name: string
  phone?: string | null
  email?: string | null
  document?: string | null
  address: string
  number: string
  complement?: string | null
  district: string
  city: string
  postal_code: string
  state_abbr: string
}

// Transportadoras que exigem uma agência de postagem ao adicionar o envio ao
// carrinho (Jadlog = 2, Azul Cargo = 3). Sem `agency` no corpo, o
// /api/v2/me/cart responde 500 genérico. Correios (1) e demais não usam.
const AGENCY_REQUIRED_CARRIERS = new Set([2, 3])

// Fluxo completo de compra: carrinho -> checkout -> geração -> impressão.
// Só é chamado a partir de uma ação explícita do admin (gasta saldo real da
// carteira do Melhor Envio em produção).
export async function purchaseAndGenerateLabel({
  companyId,
  serviceId,
  carrierCompanyId,
  agencyId,
  from,
  to,
  items,
  packageBox,
}: {
  companyId: string
  serviceId: number
  carrierCompanyId?: number | null
  agencyId?: number | null
  from: ShippingAddress
  to: ShippingAddress
  items: ShippingQuoteItem[]
  packageBox: ShippingPackage
}) {
  if (carrierCompanyId != null && AGENCY_REQUIRED_CARRIERS.has(carrierCompanyId) && !agencyId) {
    throw new Error(
      'Esta transportadora (Jadlog/Azul) exige uma agência de postagem. Configure o "ID da agência Jadlog/Azul" em Configurações → Endereço de origem para envios.'
    )
  }
  // document e phone precisam ir só com dígitos — mandar com pontuação
  // (ex.: "123.456.789-00" ou "(11) 91234-5678") faz a API do Melhor Envio
  // falhar ao salvar o pedido no carrinho com um 500 genérico, sem indicar
  // o campo culpado.
  const sanitizeAddress = (addr: ShippingAddress) => ({
    ...addr,
    document: addr.document ? onlyDigits(addr.document) : addr.document,
    phone: addr.phone ? onlyDigits(addr.phone) : addr.phone,
    postal_code: onlyDigits(addr.postal_code),
    country_id: 'BR',
  })

  const cartItem = await melhorEnvioRequest<{ id: string }>({
    companyId,
    method: 'POST',
    path: '/api/v2/me/cart',
    body: {
      service: serviceId,
      ...(agencyId ? { agency: agencyId } : {}),
      from: sanitizeAddress(from),
      to: sanitizeAddress(to),
      // Uma etiqueta por pedido: um único volume (a caixa padrão da loja) com
      // o peso somado de todos os produtos. `products` continua listando cada
      // item para a declaração de conteúdo exigida pela API.
      volumes: [
        {
          height: packageBox.height_cm,
          width: packageBox.width_cm,
          length: packageBox.length_cm,
          weight: totalWeightKg(items),
        },
      ],
      products: items.map((item, i) => ({
        name: item.name || `Item ${i + 1}`,
        quantity: item.quantity,
        unitary_value: item.unit_value ?? 0,
      })),
      options: { insurance_value: totalInsuranceValue(items), receipt: false, own_hand: false },
    },
  })

  await melhorEnvioRequest({
    companyId,
    method: 'POST',
    path: '/api/v2/me/shipment/checkout',
    body: { orders: [cartItem.id] },
  })

  await melhorEnvioRequest({
    companyId,
    method: 'POST',
    path: '/api/v2/me/shipment/generate',
    body: { orders: [cartItem.id] },
  })

  const printResult = await melhorEnvioRequest<{ url: string }>({
    companyId,
    method: 'POST',
    path: '/api/v2/me/shipment/print',
    body: { mode: 'private', orders: [cartItem.id] },
  })

  return { melhorEnvioId: cartItem.id, printUrl: printResult.url }
}

function onlyDigits(value: string) {
  return value.replace(/\D/g, '')
}

// O Melhor Envio exige peso mínimo de 0.01kg (10g) por pacote — abaixo disso
// a API rejeita com 422. Produtos leves reais (ex.: cápsulas soltas, poucos
// gramas) ficam abaixo desse piso, então aplicamos o mínimo aqui na saída
// para a transportadora, sem alterar o peso cadastrado do produto.
function clampPackageWeight(weightKg: number) {
  return Math.max(weightKg, 0.01)
}
