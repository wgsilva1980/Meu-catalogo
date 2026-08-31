import { NextResponse } from 'next/server'
import { resolveActiveCompany } from '@/lib/company'
import { listShippingAgencies } from '@/lib/melhorEnvio'

export const runtime = 'nodejs'

// Lista as agências de postagem de uma transportadora numa UF, direto do
// Melhor Envio, para o combo de "Agência de postagem" nas Configurações.
export async function GET(request: Request) {
  const active = await resolveActiveCompany()
  if (!active.ok) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const url = new URL(request.url)
  const carrier = Number(url.searchParams.get('company'))
  const state = (url.searchParams.get('state') || '').trim().toUpperCase()
  if (![2, 3].includes(carrier) || state.length !== 2) {
    return NextResponse.json({ error: 'Informe a transportadora (2 ou 3) e a UF.' }, { status: 400 })
  }

  try {
    const agencies = await listShippingAgencies({ companyId: active.companyId, carrierCompanyId: carrier, state })
    return NextResponse.json({ agencies })
  } catch (err) {
    console.error('Falha ao listar agências do Melhor Envio:', err)
    const message = err instanceof Error ? err.message : 'Falha ao buscar agências.'
    return NextResponse.json({ error: message }, { status: 502 })
  }
}
