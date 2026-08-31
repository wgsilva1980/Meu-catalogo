import { NextResponse } from 'next/server'
import { resolveActiveCompany } from '@/lib/company'
import { listShippingAgencies, listShippingCarriers } from '@/lib/melhorEnvio'

export const runtime = 'nodejs'

// Sem `company`/`state`: lista as transportadoras da conta do Melhor Envio.
// Com `company` e `state`: lista as agências de postagem daquela
// transportadora na UF. Usado pelo combo de agências nas Configurações.
export async function GET(request: Request) {
  const active = await resolveActiveCompany()
  if (!active.ok) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const url = new URL(request.url)
  const carrierParam = url.searchParams.get('company')
  const state = (url.searchParams.get('state') || '').trim().toUpperCase()
  const postalCode = (url.searchParams.get('postal_code') || '').replace(/\D/g, '')

  try {
    if (!carrierParam && !state && !postalCode) {
      const carriers = await listShippingCarriers({ companyId: active.companyId })
      return NextResponse.json({ carriers })
    }

    const carrier = Number(carrierParam)
    if (!Number.isInteger(carrier) || carrier <= 0 || (state.length !== 2 && postalCode.length !== 8)) {
      return NextResponse.json({ error: 'Informe a transportadora e o CEP ou a UF.' }, { status: 400 })
    }
    const agencies = await listShippingAgencies({
      companyId: active.companyId,
      carrierCompanyId: carrier,
      state: state.length === 2 ? state : undefined,
      postalCode: postalCode.length === 8 ? postalCode : undefined,
    })
    return NextResponse.json({ agencies })
  } catch (err) {
    console.error('Falha ao consultar o Melhor Envio:', err)
    const message = err instanceof Error ? err.message : 'Falha ao consultar o Melhor Envio.'
    return NextResponse.json({ error: message }, { status: 502 })
  }
}
