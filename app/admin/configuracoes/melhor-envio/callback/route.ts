import { NextRequest, NextResponse } from 'next/server'
import { headers, cookies } from 'next/headers'
import { resolveActiveCompany } from '@/lib/company'
import { connectAccount, OAUTH_STATE_COOKIE } from '@/lib/melhorEnvio'

export async function GET(request: NextRequest) {
  const requestHeaders = await headers()
  const host = requestHeaders.get('host')
  const protocol = host?.startsWith('localhost') ? 'http' : 'https'
  const origin = `${protocol}://${host}`

  const active = await resolveActiveCompany()
  if (!active.ok) return NextResponse.redirect(new URL('/login', origin))

  const { searchParams } = request.nextUrl
  const code = searchParams.get('code')
  const state = searchParams.get('state')
  const errorParam = searchParams.get('error')

  const cookieStore = await cookies()
  const expectedState = cookieStore.get(OAUTH_STATE_COOKIE)?.value
  cookieStore.delete(OAUTH_STATE_COOKIE)

  const fail = (message: string) =>
    NextResponse.redirect(new URL(`/admin/configuracoes?melhor_envio_erro=${encodeURIComponent(message)}`, origin))

  if (errorParam) return fail('Autorização cancelada ou negada no Melhor Envio')
  if (!code || !state) return fail('Retorno inválido do Melhor Envio')
  if (!expectedState || state !== expectedState) return fail('Sessão de autorização expirada, tente novamente')

  try {
    await connectAccount({
      companyId: active.companyId,
      code,
      redirectUri: `${origin}/admin/configuracoes/melhor-envio/callback`,
    })
  } catch (err) {
    console.error('Falha ao conectar conta do Melhor Envio:', err)
    return fail('Falha ao concluir a conexão com o Melhor Envio')
  }

  return NextResponse.redirect(new URL('/admin/configuracoes?melhor_envio_conectado=1', origin))
}
