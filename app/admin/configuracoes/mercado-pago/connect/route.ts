import { NextResponse } from 'next/server'
import { headers, cookies } from 'next/headers'
import { randomUUID } from 'crypto'
import { resolveActiveCompany } from '@/lib/company'
import { getAuthorizeUrl, mercadoPagoRedirectUri, OAUTH_STATE_COOKIE } from '@/lib/mercadoPago'

export async function GET() {
  const requestHeaders = await headers()
  const host = requestHeaders.get('host')
  const protocol = host?.startsWith('localhost') ? 'http' : 'https'
  const origin = `${protocol}://${host}`

  const active = await resolveActiveCompany()
  if (!active.ok) return NextResponse.redirect(new URL('/login', origin))

  const redirectUri = mercadoPagoRedirectUri(origin)
  const state = randomUUID()
  const cookieStore = await cookies()
  cookieStore.set(OAUTH_STATE_COOKIE, state, {
    httpOnly: true,
    secure: protocol === 'https',
    maxAge: 600,
    path: '/',
  })

  let authorizeUrl: string
  try {
    authorizeUrl = getAuthorizeUrl({ redirectUri, state })
  } catch (err) {
    console.error('Falha ao montar URL de autorização do Mercado Pago:', err)
    return NextResponse.redirect(
      new URL(`/admin/configuracoes?mercado_pago_erro=${encodeURIComponent('Integração não configurada')}`, origin)
    )
  }

  return NextResponse.redirect(authorizeUrl)
}
