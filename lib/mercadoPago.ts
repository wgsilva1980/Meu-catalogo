// Cliente para o Mercado Pago (Checkout Pro, modelo marketplace/OAuth).
// Uma aplicação da plataforma (MERCADO_PAGO_* nas env vars) é compartilhada;
// cada empresa conecta a própria conta e o token dela fica em
// `mercado_pago_accounts`. Nunca importar em código client.
import { createHmac, timingSafeEqual } from 'crypto'
import { createAdminClient } from '@/lib/supabase/admin'

const AUTH_URL = 'https://auth.mercadopago.com.br/authorization'
const API_BASE = 'https://api.mercadopago.com'

export const OAUTH_STATE_COOKIE = 'mercado_pago_oauth_state'

// redirect_uri fixo do OAuth — precisa bater EXATAMENTE com o cadastrado na
// aplicação do Mercado Pago. Como as URLs de deploy da Vercel variam, o
// fallback pelo host só serve para desenvolvimento local.
export function mercadoPagoRedirectUri(fallbackOrigin: string): string {
  const configured = process.env.MERCADO_PAGO_REDIRECT_URI?.trim()
  return configured || `${fallbackOrigin}/admin/configuracoes/mercado-pago/callback`
}

export function getAuthorizeUrl({ redirectUri, state }: { redirectUri: string; state: string }) {
  const clientId = process.env.MERCADO_PAGO_CLIENT_ID?.trim()
  if (!clientId) throw new Error('MERCADO_PAGO_CLIENT_ID não configurada')
  const url = new URL(AUTH_URL)
  url.searchParams.set('client_id', clientId)
  url.searchParams.set('response_type', 'code')
  url.searchParams.set('platform_id', 'mp')
  url.searchParams.set('redirect_uri', redirectUri)
  url.searchParams.set('state', state)
  return url.toString()
}

type OAuthTokenResponse = {
  access_token: string
  refresh_token: string
  expires_in: number
  user_id: number | string
  public_key?: string
  live_mode?: boolean
}

async function requestToken(body: Record<string, string>): Promise<OAuthTokenResponse> {
  const clientId = process.env.MERCADO_PAGO_CLIENT_ID?.trim()
  const clientSecret = process.env.MERCADO_PAGO_CLIENT_SECRET?.trim()
  if (!clientId || !clientSecret) throw new Error('Credenciais do Mercado Pago não configuradas')

  const res = await fetch(`${API_BASE}/oauth/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({ client_id: clientId, client_secret: clientSecret, ...body }),
  })
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(
      `Falha ao obter token do Mercado Pago (${res.status}) [client_id: ${clientId}, redirect_uri: ${
        body.redirect_uri ?? '(n/a)'
      }]: ${text}`
    )
  }
  return (await res.json()) as OAuthTokenResponse
}

// Nem o `live_mode` do OAuth nem o prefixo do access_token são confiáveis
// para saber se a conta conectada é uma conta de teste: ambos vêm "de
// produção" (live_mode: true, token "APP_USR-...") mesmo logando com um
// usuário de teste do Mercado Pago — confirmado testando com uma conta real
// de "Contas de teste" do painel deles. O único sinal confiável é o próprio
// GET /users/me, que marca a conta com tags: ["test_user", ...] e o objeto
// test_data.test_user quando é uma conta de teste.
type MercadoPagoUser = {
  id: string
  nickname: string | null
  email: string | null
  site_id: string | null
  isTestUser: boolean
}

async function fetchMercadoPagoUser(accessToken: string): Promise<MercadoPagoUser | null> {
  const res = await fetch(`${API_BASE}/users/me`, {
    headers: { Authorization: `Bearer ${accessToken}`, Accept: 'application/json' },
  })
  if (!res.ok) {
    console.error('Falha ao buscar detalhes da conta do Mercado Pago:', res.status, await res.text().catch(() => ''))
    return null
  }
  const data = (await res.json()) as Record<string, unknown>
  const tags = Array.isArray(data.tags) ? (data.tags as unknown[]) : []
  const testData = (data.test_data as Record<string, unknown> | undefined) ?? undefined
  return {
    id: String(data.id ?? ''),
    nickname: typeof data.nickname === 'string' ? data.nickname : null,
    email: typeof data.email === 'string' ? data.email : null,
    site_id: typeof data.site_id === 'string' ? data.site_id : null,
    isTestUser: Boolean(testData?.test_user) || tags.includes('test_user'),
  }
}

export async function connectAccount({
  companyId,
  code,
  redirectUri,
}: {
  companyId: string
  code: string
  redirectUri: string
}) {
  const token = await requestToken({ grant_type: 'authorization_code', code, redirect_uri: redirectUri })
  // Melhor esforço: sem isso ainda dá pra conectar a conta, só não dá pra
  // confirmar de cara se é uma conta de teste (a tela recalcula depois).
  const user = await fetchMercadoPagoUser(token.access_token).catch(() => null)
  const admin = createAdminClient()
  await admin.from('mercado_pago_accounts').upsert({
    company_id: companyId,
    mp_user_id: String(token.user_id),
    access_token: token.access_token,
    refresh_token: token.refresh_token,
    public_key: token.public_key ?? null,
    live_mode: user ? !user.isTestUser : Boolean(token.live_mode),
    expires_at: new Date(Date.now() + token.expires_in * 1000).toISOString(),
  })
}

export async function disconnectAccount(companyId: string) {
  const admin = createAdminClient()
  await admin.from('mercado_pago_accounts').delete().eq('company_id', companyId)
}

type MercadoPagoAccountRow = {
  company_id: string
  mp_user_id: string
  access_token: string
  refresh_token: string
  live_mode: boolean
  expires_at: string
}

async function refreshIfNeeded(account: MercadoPagoAccountRow): Promise<string> {
  const expiresInMs = new Date(account.expires_at).getTime() - Date.now()
  if (expiresInMs > 24 * 60 * 60 * 1000) return account.access_token

  try {
    const token = await requestToken({ grant_type: 'refresh_token', refresh_token: account.refresh_token })
    const user = await fetchMercadoPagoUser(token.access_token).catch(() => null)
    const admin = createAdminClient()
    await admin
      .from('mercado_pago_accounts')
      .update({
        access_token: token.access_token,
        refresh_token: token.refresh_token,
        ...(user ? { live_mode: !user.isTestUser } : {}),
        expires_at: new Date(Date.now() + token.expires_in * 1000).toISOString(),
      })
      .eq('company_id', account.company_id)
    return token.access_token
  } catch (err) {
    console.error('Falha ao renovar token do Mercado Pago:', err)
    return account.access_token
  }
}

async function getAccount(companyId: string): Promise<MercadoPagoAccountRow | null> {
  const admin = createAdminClient()
  const { data } = await admin
    .from('mercado_pago_accounts')
    .select('company_id, mp_user_id, access_token, refresh_token, live_mode, expires_at')
    .eq('company_id', companyId)
    .maybeSingle()
  return (data as MercadoPagoAccountRow | null) ?? null
}

export type MercadoPagoAccountDetails = {
  id: string
  nickname: string | null
  email: string | null
  site_id: string | null
  // Vem de GET /users/me (tags/test_data.test_user) — ver fetchMercadoPagoUser.
  live_mode: boolean
}

// Detalhes da conta do Mercado Pago conectada (apelido/e-mail/teste-ou-não),
// buscados na hora em vez de guardados — assim a tela de Configurações
// sempre mostra quem está realmente conectado, mesmo que o token tenha sido
// renovado. Best effort: se a API falhar, devolve null e a tela cai para o
// que já tem salvo (`account.live_mode`, que pode estar desatualizado).
export async function getAccountDetails(companyId: string): Promise<MercadoPagoAccountDetails | null> {
  const account = await getAccount(companyId)
  if (!account) return null
  const accessToken = await refreshIfNeeded(account)

  const user = await fetchMercadoPagoUser(accessToken).catch((err) => {
    console.error('Falha ao buscar detalhes da conta do Mercado Pago:', err)
    return null
  })
  if (!user) return null

  return {
    id: user.id || account.mp_user_id,
    nickname: user.nickname,
    email: user.email,
    site_id: user.site_id,
    live_mode: !user.isTestUser,
  }
}

export async function getConnectedCompanyId(mpUserId: string): Promise<string | null> {
  const admin = createAdminClient()
  const { data } = await admin
    .from('mercado_pago_accounts')
    .select('company_id')
    .eq('mp_user_id', mpUserId)
    .maybeSingle()
  return (data as { company_id: string } | null)?.company_id ?? null
}

// Cria a preferência de Checkout Pro para um pedido. Uma linha única com o
// total já calculado do pedido — sempre bate com o valor cobrado.
export async function createCheckoutPreference({
  companyId,
  order,
  title,
  backUrl,
  notificationUrl,
  payer,
}: {
  companyId: string
  order: { id: string; number: number; total: number }
  title: string
  backUrl: string
  notificationUrl: string
  payer?: { name?: string | null; email?: string | null }
}): Promise<{ id: string; initPoint: string }> {
  const account = await getAccount(companyId)
  if (!account) throw new Error('Empresa não conectou a conta do Mercado Pago')
  const accessToken = await refreshIfNeeded(account)

  const res = await fetch(`${API_BASE}/checkout/preferences`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify({
      items: [
        {
          id: order.id,
          title,
          quantity: 1,
          unit_price: Math.round(Number(order.total) * 100) / 100,
          currency_id: 'BRL',
        },
      ],
      external_reference: order.id,
      metadata: { order_id: order.id, order_number: order.number },
      back_urls: { success: backUrl, pending: backUrl, failure: backUrl },
      auto_return: 'approved',
      notification_url: notificationUrl,
      ...(payer?.name || payer?.email
        ? { payer: { ...(payer.name ? { name: payer.name } : {}), ...(payer.email ? { email: payer.email } : {}) } }
        : {}),
    }),
  })
  const data = (await res.json().catch(() => null)) as
    | { id?: string; init_point?: string; sandbox_init_point?: string; message?: string }
    | null
  if (!res.ok || !data?.id) {
    throw new Error(`Falha ao criar a cobrança no Mercado Pago (${res.status}): ${data?.message ?? ''}`)
  }
  // Checkout Pro sempre abre pelo `init_point`, inclusive em testes (contas de
  // teste / usuários de teste). O `sandbox_init_point` é legado e não é o
  // fluxo recomendado para este produto — só é usado se o `init_point` faltar.
  const initPoint = data.init_point || data.sandbox_init_point
  if (!initPoint) throw new Error('Mercado Pago não retornou o link de pagamento.')
  return { id: data.id, initPoint }
}

export type MercadoPagoPayment = {
  id: string
  status: string
  status_detail: string | null
  transaction_amount: number | null
  external_reference: string | null
  date_approved: string | null
}

export async function getPayment({
  companyId,
  paymentId,
}: {
  companyId: string
  paymentId: string
}): Promise<MercadoPagoPayment | null> {
  const account = await getAccount(companyId)
  if (!account) return null
  const accessToken = await refreshIfNeeded(account)

  const res = await fetch(`${API_BASE}/v1/payments/${paymentId}`, {
    headers: { Authorization: `Bearer ${accessToken}`, Accept: 'application/json' },
  })
  if (!res.ok) {
    console.error('Falha ao buscar pagamento no Mercado Pago:', res.status, await res.text().catch(() => ''))
    return null
  }
  const p = (await res.json()) as Record<string, unknown>
  return {
    id: String(p.id),
    status: typeof p.status === 'string' ? p.status : 'unknown',
    status_detail: typeof p.status_detail === 'string' ? p.status_detail : null,
    transaction_amount: typeof p.transaction_amount === 'number' ? p.transaction_amount : null,
    external_reference: typeof p.external_reference === 'string' ? p.external_reference : null,
    date_approved: typeof p.date_approved === 'string' ? p.date_approved : null,
  }
}

// pending/in_process/authorized -> 'pending'; approved -> 'approved';
// rejected -> 'rejected'; cancelled -> 'cancelled'; refunded/charged_back ->
// 'refunded'.
export function normalizePaymentStatus(mpStatus: string): 'pending' | 'approved' | 'rejected' | 'cancelled' | 'refunded' {
  switch (mpStatus) {
    case 'approved':
      return 'approved'
    case 'rejected':
      return 'rejected'
    case 'cancelled':
      return 'cancelled'
    case 'refunded':
    case 'charged_back':
      return 'refunded'
    default:
      return 'pending'
  }
}

// Valida a assinatura do webhook (header x-signature: "ts=...,v1=...").
// manifest = "id:<data.id>;request-id:<x-request-id>;ts:<ts>;", omitindo
// qualquer componente ausente na notificação. Sem secret configurada, não dá
// para validar — retorna true e loga um aviso.
export function verifyWebhookSignature({
  dataId,
  requestId,
  signatureHeader,
}: {
  dataId: string
  requestId: string | null
  signatureHeader: string | null
}): boolean {
  const secret = process.env.MERCADO_PAGO_WEBHOOK_SECRET?.trim()
  if (!secret) {
    console.warn('MERCADO_PAGO_WEBHOOK_SECRET não configurada — webhook aceito sem validação de assinatura.')
    return true
  }
  if (!signatureHeader) return false

  const parts = Object.fromEntries(
    signatureHeader.split(',').map((kv) => {
      const [k, v] = kv.split('=')
      return [k?.trim(), v?.trim()]
    })
  ) as { ts?: string; v1?: string }
  if (!parts.ts || !parts.v1) return false

  const id = /[a-zA-Z]/.test(dataId) ? dataId.toLowerCase() : dataId
  // O request-id nem sempre vem na notificação (algumas versões do webhook
  // do Mercado Pago não enviam o header x-request-id) — nesse caso o trecho
  // precisa ser omitido do manifest, não deixado vazio. Incluir
  // "request-id:;" gera um HMAC diferente do calculado pelo Mercado Pago e
  // rejeita notificações de pagamento legítimas.
  const manifestParts = [`id:${id}`]
  if (requestId) manifestParts.push(`request-id:${requestId}`)
  manifestParts.push(`ts:${parts.ts}`)
  const manifest = manifestParts.join(';') + ';'
  const expected = createHmac('sha256', secret).update(manifest).digest('hex')
  try {
    return timingSafeEqual(Buffer.from(expected), Buffer.from(parts.v1))
  } catch {
    return false
  }
}
