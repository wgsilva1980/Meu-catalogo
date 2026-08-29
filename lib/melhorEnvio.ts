// Cliente para a API do Melhor Envio (https://docs.melhorenvio.com.br).
// Um único app (client_id/secret em env vars) é compartilhado pela
// plataforma; cada empresa conecta e guarda seu próprio token em
// `melhor_envio_accounts`. Nunca importar em código client — usa a service
// role para ler/gravar tokens, que não passam pelo navegador do usuário.
import { createAdminClient } from '@/lib/supabase/admin'
import type { MelhorEnvioEnvironment } from '@/lib/types'

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
    throw new Error(`Falha ao obter token do Melhor Envio (${res.status}): ${text}`)
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
    throw new Error(`Melhor Envio retornou erro (${res.status})`)
  }
  return data as T
}

export type ShippingQuoteItem = {
  width_cm: number
  height_cm: number
  length_cm: number
  weight_kg: number
  quantity: number
  insurance_value: number
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
}: {
  companyId: string
  fromPostalCode: string
  toPostalCode: string
  items: ShippingQuoteItem[]
}) {
  const options = await melhorEnvioRequest<ShippingQuoteOption[]>({
    companyId,
    method: 'POST',
    path: '/api/v2/me/shipment/calculate',
    body: {
      from: { postal_code: onlyDigits(fromPostalCode) },
      to: { postal_code: onlyDigits(toPostalCode) },
      products: items.map((item, i) => ({
        id: `item-${i}`,
        width: item.width_cm,
        height: item.height_cm,
        length: item.length_cm,
        weight: item.weight_kg,
        insurance_value: item.insurance_value,
        quantity: item.quantity,
      })),
    },
  })
  // a API retorna também as opções sem cotação (ex: agência não atende a
  // região) com um campo "error" — só interessam as que têm preço.
  return options.filter((option) => !option.error && option.price)
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

// Fluxo completo de compra: carrinho -> checkout -> geração -> impressão.
// Só é chamado a partir de uma ação explícita do admin (gasta saldo real da
// carteira do Melhor Envio em produção).
export async function purchaseAndGenerateLabel({
  companyId,
  serviceId,
  from,
  to,
  items,
}: {
  companyId: string
  serviceId: number
  from: ShippingAddress
  to: ShippingAddress
  items: ShippingQuoteItem[]
}) {
  const cartItem = await melhorEnvioRequest<{ id: string }>({
    companyId,
    method: 'POST',
    path: '/api/v2/me/cart',
    body: {
      service: serviceId,
      from: { ...from, postal_code: onlyDigits(from.postal_code), country_id: 'BR' },
      to: { ...to, postal_code: onlyDigits(to.postal_code), country_id: 'BR' },
      volumes: items.map((item) => ({
        height: item.height_cm,
        width: item.width_cm,
        length: item.length_cm,
        weight: item.weight_kg,
      })),
      options: { insurance_value: items.reduce((sum, i) => sum + i.insurance_value, 0), receipt: false, own_hand: false },
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
