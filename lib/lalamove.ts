// Cliente para a API da Lalamove (https://developers.lalamove.com) — usada
// para COTAR entrega por motoboy no link público de pedido.
//
// Diferente do Melhor Envio, a Lalamove não usa OAuth por empresa: há um app
// único da plataforma, com API key + secret em env vars, e autenticação por
// assinatura HMAC-SHA256 em cada requisição. Este módulo nunca deve ser
// importado em código client — ele lê o secret do ambiente.
//
// Fase 1: só cotação (`POST /v3/quotations`). Não cria a corrida (isso gasta
// saldo real e exige agendamento de coleta) — a loja aciona o motoboy à mão.

import crypto from 'node:crypto'

type LalamoveEnvironment = 'sandbox' | 'production'

const BASE_URL: Record<LalamoveEnvironment, string> = {
  sandbox: 'https://rest.sandbox.lalamove.com',
  production: 'https://rest.lalamove.com',
}

export function lalamoveEnvironment(): LalamoveEnvironment {
  return process.env.LALAMOVE_ENVIRONMENT === 'production' ? 'production' : 'sandbox'
}

export function lalamoveMarket(): string {
  return process.env.LALAMOVE_MARKET?.trim() || 'BR'
}

export function lalamoveConfigured(): boolean {
  return Boolean(process.env.LALAMOVE_API_KEY?.trim() && process.env.LALAMOVE_API_SECRET?.trim())
}

type LalamoveRequestOptions = {
  method: 'GET' | 'POST'
  path: string
  body?: unknown
}

async function lalamoveRequest<T>({ method, path, body }: LalamoveRequestOptions): Promise<T> {
  const apiKey = process.env.LALAMOVE_API_KEY?.trim()
  const apiSecret = process.env.LALAMOVE_API_SECRET?.trim()
  if (!apiKey || !apiSecret) throw new Error('Credenciais da Lalamove não configuradas (LALAMOVE_API_KEY / LALAMOVE_API_SECRET)')

  const environment = lalamoveEnvironment()
  const timestamp = String(Date.now())
  const rawBody = body ? JSON.stringify(body) : ''
  // Assinatura: TIMESTAMP\r\nMÉTODO\r\nCAMINHO\r\n\r\nCORPO
  const rawSignature = `${timestamp}\r\n${method}\r\n${path}\r\n\r\n${rawBody}`
  const signature = crypto.createHmac('sha256', apiSecret).update(rawSignature).digest('hex')

  const res = await fetch(`${BASE_URL[environment]}${path}`, {
    method,
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      Authorization: `hmac ${apiKey}:${timestamp}:${signature}`,
      Market: lalamoveMarket(),
      'Request-ID': crypto.randomUUID(),
    },
    body: rawBody || undefined,
  })

  const text = await res.text()
  let data: unknown = null
  try {
    data = text ? JSON.parse(text) : null
  } catch {
    data = text
  }

  if (!res.ok) {
    console.error('Erro na API da Lalamove:', path, res.status, data)
    const detail = typeof data === 'string' ? data : JSON.stringify(data)
    throw new Error(`Lalamove retornou erro (${res.status}) em ${path}: ${detail}`)
  }
  return data as T
}

export type GeoPoint = { lat: number; lng: number }

// CEP -> coordenadas. Usa a AwesomeAPI (grátis, sem chave) que devolve o
// centróide do CEP — precisão de rua, suficiente para ESTIMAR o valor do
// motoboy. Se GOOGLE_MAPS_API_KEY estiver setada e houver endereço completo,
// tenta o Google primeiro (mais preciso). Retorna null se nada resolver.
// Aceita um par lat/lng de qualquer fonte (string ou número) e só devolve um
// GeoPoint quando ambos são finitos e não caem em (0,0) — que várias APIs
// devolvem como "não encontrei".
function toGeoPoint(rawLat: unknown, rawLng: unknown): GeoPoint | null {
  const lat = Number(rawLat)
  const lng = Number(rawLng)
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null
  if (lat === 0 && lng === 0) return null
  if (Math.abs(lat) > 90 || Math.abs(lng) > 180) return null
  return { lat, lng }
}

async function geocodeViaGoogle(digits: string, addressLine?: string): Promise<GeoPoint | null> {
  const googleKey = process.env.GOOGLE_MAPS_API_KEY?.trim()
  if (!googleKey || (!addressLine && !digits)) return null
  try {
    const query = [addressLine, digits && `CEP ${digits}`, 'Brasil'].filter(Boolean).join(', ')
    const url = new URL('https://maps.googleapis.com/maps/api/geocode/json')
    url.searchParams.set('address', query)
    url.searchParams.set('key', googleKey)
    url.searchParams.set('region', 'br')
    const res = await fetch(url, { cache: 'no-store' })
    const data = (await res.json()) as {
      status: string
      results: Array<{ geometry: { location: { lat: number; lng: number } } }>
    }
    const loc = data.results?.[0]?.geometry?.location
    if (data.status === 'OK' && loc) return toGeoPoint(loc.lat, loc.lng)
  } catch (err) {
    console.error('Geocodificação Google falhou:', err)
  }
  return null
}

async function geocodeViaAwesomeApi(digits: string): Promise<GeoPoint | null> {
  if (digits.length !== 8) return null
  try {
    const res = await fetch(`https://cep.awesomeapi.com.br/json/${digits}`, { cache: 'no-store' })
    if (!res.ok) return null
    const data = (await res.json()) as { lat?: string; lng?: string }
    return toGeoPoint(data.lat, data.lng)
  } catch (err) {
    console.error('Geocodificação AwesomeAPI falhou:', err)
    return null
  }
}

async function geocodeViaBrasilApi(digits: string): Promise<GeoPoint | null> {
  if (digits.length !== 8) return null
  try {
    const res = await fetch(`https://brasilapi.com.br/api/cep/v2/${digits}`, { cache: 'no-store' })
    if (!res.ok) return null
    const data = (await res.json()) as {
      location?: { coordinates?: { latitude?: string | number; longitude?: string | number } }
    }
    const coords = data.location?.coordinates
    return coords ? toGeoPoint(coords.latitude, coords.longitude) : null
  } catch (err) {
    console.error('Geocodificação BrasilAPI falhou:', err)
    return null
  }
}

// Último recurso: Nominatim (OpenStreetMap). Cobre praticamente qualquer CEP/
// endereço do Brasil. A política de uso pede User-Agent identificável e no
// máximo 1 req/s — o que o fluxo de cotação (uma cotação por clique) respeita.
async function geocodeViaNominatim(digits: string, addressLine?: string): Promise<GeoPoint | null> {
  const attempts: Array<Record<string, string>> = []
  if (addressLine) attempts.push({ q: `${addressLine}, Brasil` })
  if (digits.length === 8) {
    attempts.push({ postalcode: `${digits.slice(0, 5)}-${digits.slice(5)}`, country: 'Brazil' })
  }
  for (const params of attempts) {
    try {
      const url = new URL('https://nominatim.openstreetmap.org/search')
      url.searchParams.set('format', 'jsonv2')
      url.searchParams.set('limit', '1')
      for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v)
      const res = await fetch(url, {
        cache: 'no-store',
        headers: { 'User-Agent': 'meu-catalogo/1.0 (pedido motoboy geocoding)' },
      })
      if (!res.ok) continue
      const data = (await res.json()) as Array<{ lat?: string; lon?: string }>
      const hit = data?.[0]
      const point = hit ? toGeoPoint(hit.lat, hit.lon) : null
      if (point) return point
    } catch (err) {
      console.error('Geocodificação Nominatim falhou:', err)
    }
  }
  return null
}

// CEP/endereço -> coordenadas. Tenta vários provedores em ordem até um
// resolver: Google (se GOOGLE_MAPS_API_KEY), AwesomeAPI, BrasilAPI e, por
// último, Nominatim/OSM. Todos devolvem no máximo o centróide do CEP —
// precisão de rua, suficiente para ESTIMAR o valor do motoboy. Retorna null
// só se nenhum provedor resolver.
export async function geocode(zipCode: string | null | undefined, addressLine?: string): Promise<GeoPoint | null> {
  const digits = (zipCode ?? '').replace(/\D/g, '')

  const providers: Array<() => Promise<GeoPoint | null>> = [
    () => geocodeViaGoogle(digits, addressLine),
    () => geocodeViaAwesomeApi(digits),
    () => geocodeViaBrasilApi(digits),
    () => geocodeViaNominatim(digits, addressLine),
  ]

  for (const run of providers) {
    const point = await run()
    if (point) return point
  }
  return null
}

export type MotoQuoteStop = { lat: number; lng: number; address: string }

export type MotoQuote = {
  quotationId: string
  serviceType: string
  total: number
  currency: string
  distanceMeters: number | null
  expiresAt: string | null
}

type LalamoveQuotationResponse = {
  data: {
    quotationId: string
    serviceType: string
    expiresAt?: string
    priceBreakdown: { total: string; currency: string }
    distance?: { value: string; unit: string }
  }
}

// Uma cotação ponto-a-ponto (loja -> cliente). serviceType típico no Brasil:
// 'MOTORCYCLE' (motoboy). A cotação vale ~5 min do lado da Lalamove.
export async function getMotoQuote({
  origin,
  destination,
  serviceType = 'MOTORCYCLE',
}: {
  origin: MotoQuoteStop
  destination: MotoQuoteStop
  serviceType?: string
}): Promise<MotoQuote> {
  const toStop = (s: MotoQuoteStop) => ({
    coordinates: { lat: String(s.lat), lng: String(s.lng) },
    address: s.address || 'Brasil',
  })

  const { data } = await lalamoveRequest<LalamoveQuotationResponse>({
    method: 'POST',
    path: '/v3/quotations',
    body: {
      data: {
        serviceType,
        language: 'pt_BR',
        stops: [toStop(origin), toStop(destination)],
      },
    },
  })

  return {
    quotationId: data.quotationId,
    serviceType: data.serviceType ?? serviceType,
    total: Number(data.priceBreakdown?.total ?? 0),
    currency: data.priceBreakdown?.currency ?? 'BRL',
    distanceMeters: data.distance?.value != null ? Number(data.distance.value) : null,
    expiresAt: data.expiresAt ?? null,
  }
}

export type DeliveryQuoteAddress = {
  zip_code?: string | null
  street?: string | null
  number?: string | null
  neighborhood?: string | null
  city?: string | null
  state?: string | null
}

export type OriginCompany = {
  shipping_origin_zip_code: string | null
  shipping_origin_street: string | null
  shipping_origin_number: string | null
  shipping_origin_neighborhood: string | null
  shipping_origin_city: string | null
  shipping_origin_state: string | null
  shipping_origin_lat: number | null
  shipping_origin_lng: number | null
  lalamove_service_type: string | null
}

function addressLine(a: DeliveryQuoteAddress): string {
  return [
    [a.street, a.number].filter(Boolean).join(', '),
    a.neighborhood,
    [a.city, a.state].filter(Boolean).join(' - '),
  ]
    .filter(Boolean)
    .join(', ')
}

export type ResolvedQuote =
  | { ok: true; quote: MotoQuote; originGeo: GeoPoint; destGeo: GeoPoint; originGeoWasCached: boolean }
  | { ok: false; status: number; error: string }

// Cota motoboy da loja (`company`) até o `destination`. Geocodifica a origem
// usando o cache em `company.shipping_origin_lat/lng` quando disponível
// (senão geocodifica o CEP de origem e sinaliza `originGeoWasCached: false`
// para o chamador persistir). Erros viram `{ ok: false, status, error }` com
// mensagem amigável.
export async function resolveMotoQuote({
  company,
  destination,
}: {
  company: OriginCompany
  destination: DeliveryQuoteAddress
}): Promise<ResolvedQuote> {
  if (!lalamoveConfigured()) {
    return { ok: false, status: 503, error: 'Cotação de motoboy indisponível no momento.' }
  }
  if (!company.shipping_origin_zip_code) {
    return { ok: false, status: 422, error: 'A loja ainda não cadastrou o endereço de origem para calcular a entrega.' }
  }
  if (!destination.zip_code) {
    return { ok: false, status: 422, error: 'Informe o CEP de entrega.' }
  }

  let originGeo: GeoPoint | null = null
  let originGeoWasCached = false
  if (company.shipping_origin_lat != null && company.shipping_origin_lng != null) {
    originGeo = { lat: Number(company.shipping_origin_lat), lng: Number(company.shipping_origin_lng) }
    originGeoWasCached = true
  } else {
    originGeo = await geocode(company.shipping_origin_zip_code, addressLine({
      street: company.shipping_origin_street,
      number: company.shipping_origin_number,
      neighborhood: company.shipping_origin_neighborhood,
      city: company.shipping_origin_city,
      state: company.shipping_origin_state,
    }))
  }
  if (!originGeo) {
    return {
      ok: false,
      status: 422,
      error: 'Não foi possível localizar o endereço de origem da loja para cotar o motoboy. Confira o CEP de origem em Configurações.',
    }
  }

  const destGeo = await geocode(destination.zip_code, addressLine(destination))
  if (!destGeo) {
    return { ok: false, status: 422, error: 'Não foi possível localizar esse CEP para cotar o motoboy. Confira o CEP ou escolha outra forma de entrega.' }
  }

  try {
    const quote = await getMotoQuote({
      origin: { ...originGeo, address: addressLine({
        street: company.shipping_origin_street,
        number: company.shipping_origin_number,
        neighborhood: company.shipping_origin_neighborhood,
        city: company.shipping_origin_city,
        state: company.shipping_origin_state,
      }) },
      destination: { ...destGeo, address: addressLine(destination) },
      serviceType: company.lalamove_service_type || 'MOTORCYCLE',
    })
    if (!quote.total || quote.total <= 0) {
      return { ok: false, status: 422, error: 'Sem motoboy disponível para esse endereço no momento. Escolha outra forma de entrega.' }
    }
    return { ok: true, quote, originGeo, destGeo, originGeoWasCached }
  } catch (err) {
    console.error('Falha ao cotar motoboy na Lalamove:', err)
    return { ok: false, status: 502, error: 'Não foi possível cotar o motoboy agora. Tente de novo ou escolha outra forma de entrega.' }
  }
}
