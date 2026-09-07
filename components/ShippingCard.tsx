'use client'

import { useEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import Card from '@/components/Card'
import Button from '@/components/Button'
import type { Shipment } from '@/lib/types'

type QuoteOption = {
  id: number
  name: string
  price: string
  delivery_time: number
  company: { id: number; name: string; picture: string }
}

// Jadlog (2) e Azul Cargo (3) exigem uma agência de postagem no envio ao
// carrinho do Melhor Envio; Correios e demais não usam.
const AGENCY_REQUIRED_CARRIERS = new Set([2, 3])

type TrackingEvent = { date: string | null; description: string | null; location: string | null }
type TrackingInfo = { code: string | null; status: string | null; events: TrackingEvent[] }

const TRACKING_STATUS_LABEL: Record<string, string> = {
  pending: 'Aguardando postagem',
  released: 'Etiqueta liberada',
  received: 'Recebido pela transportadora',
  posted: 'Postado',
  collected: 'Coletado',
  in_transit: 'Em trânsito',
  delivered: 'Entregue',
  returning: 'Em devolução',
  returned: 'Devolvido',
  canceled: 'Cancelado',
  cancelled: 'Cancelado',
}

function trackingUrl(code: string) {
  return `https://melhorrastreio.com.br/rastreio/${encodeURIComponent(code)}`
}

function formatEventDate(raw: string | null) {
  if (!raw) return ''
  const d = new Date(raw)
  return Number.isNaN(d.getTime()) ? raw : d.toLocaleString('pt-BR')
}

export default function ShippingCard({
  orderId,
  connected,
  shipment,
  bare = false,
}: {
  orderId: string
  connected: boolean
  shipment: Shipment | null
  // Quando renderizado dentro de outro card (ex.: seção Entrega do pedido),
  // dispensa a moldura própria.
  bare?: boolean
}) {
  const [options, setOptions] = useState<QuoteOption[]>([])
  const [selected, setSelected] = useState<QuoteOption | null>(null)
  const [loading, setLoading] = useState(false)
  const [purchasing, setPurchasing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [printUrl, setPrintUrl] = useState<string | null>(shipment?.print_url ?? null)
  const [generated, setGenerated] = useState(shipment?.status === 'gerado')
  const [box, setBox] = useState<{ name: string; fits: boolean } | null>(null)
  const [preferredMissing, setPreferredMissing] = useState(false)
  const [originAgencyId, setOriginAgencyId] = useState<number | null>(null)
  const [tracking, setTracking] = useState<TrackingInfo | null>(
    shipment?.tracking_code ? { code: shipment.tracking_code, status: null, events: [] } : null
  )
  const [trackingStatus, setTrackingStatus] = useState<'idle' | 'loading' | 'error'>('idle')
  const trackingLoadedRef = useRef(false)

  async function refreshTracking() {
    setTrackingStatus('loading')
    try {
      const res = await fetch(`/api/pedidos/${orderId}/frete/rastreio`)
      const data = await res.json()
      if (!res.ok) {
        setTrackingStatus('error')
        return
      }
      setTracking({ code: data.code ?? null, status: data.status ?? null, events: data.events ?? [] })
      setTrackingStatus('idle')
    } catch {
      setTrackingStatus('error')
    }
  }

  // Carrega o rastreio automaticamente ao abrir um pedido com etiqueta já
  // gerada, para a timeline aparecer na própria tela sem exigir um clique.
  useEffect(() => {
    if (generated && printUrl && !trackingLoadedRef.current) {
      trackingLoadedRef.current = true
      refreshTracking()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [generated, printUrl])

  async function handleCalculate() {
    setLoading(true)
    setError(null)
    setOptions([])
    setSelected(null)
    setBox(null)
    setPreferredMissing(false)
    setOriginAgencyId(null)
    try {
      const res = await fetch(`/api/pedidos/${orderId}/frete/calcular`, { method: 'POST' })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error ?? 'Falha ao calcular frete.')
        return
      }
      const opts: QuoteOption[] = data.options ?? []
      setOptions(opts)
      setBox(data.box ?? null)
      setOriginAgencyId(data.originAgencyId ?? null)
      if (opts.length === 0) {
        setError('Nenhuma opção de frete disponível para este endereço.')
      } else if (data.preferredCarrierId != null) {
        const preferred = opts.find((o) => o.company.id === data.preferredCarrierId)
        setSelected(preferred ?? opts[0])
        setPreferredMissing(!preferred)
      } else {
        setSelected(opts[0])
      }
    } catch {
      setError('Falha ao calcular frete.')
    } finally {
      setLoading(false)
    }
  }

  async function handlePurchase() {
    if (!selected) return
    setPurchasing(true)
    setError(null)
    try {
      const res = await fetch(`/api/pedidos/${orderId}/frete/comprar`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          service_id: selected.id,
          service_name: selected.name,
          price: Number(selected.price),
          carrier_company_id: selected.company.id,
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error ?? 'Falha ao gerar etiqueta.')
        return
      }
      setPrintUrl(data.printUrl)
      setGenerated(true)
    } catch {
      setError('Falha ao gerar etiqueta.')
    } finally {
      setPurchasing(false)
    }
  }

  if (!connected) {
    return (
      <Wrap bare={bare} gap="gap-2">
        <h2 className="text-sm font-bold">Frete</h2>
        <p className="text-xs text-muted">
          Conecte sua conta do Melhor Envio em{' '}
          <a href="/admin/configuracoes" className="text-accent underline">
            Configurações
          </a>{' '}
          para calcular frete e gerar etiquetas.
        </p>
      </Wrap>
    )
  }

  const needsAgency =
    selected != null && AGENCY_REQUIRED_CARRIERS.has(selected.company.id) && originAgencyId == null

  if (generated && printUrl) {
    const serviceName = shipment?.service_name ?? selected?.name ?? ''
    const price = shipment?.price ?? (selected ? Number(selected.price) : 0)
    const code = tracking?.code ?? null
    return (
      <Wrap bare={bare} gap="gap-2">
        <h2 className="text-sm font-bold">Frete</h2>
        <p className="text-sm">
          Etiqueta gerada — {serviceName} · R$ {Number(price ?? 0).toFixed(2).replace('.', ',')}
        </p>
        <a href={printUrl} target="_blank" rel="noreferrer" className="text-sm font-semibold text-accent underline w-fit">
          Ver/imprimir etiqueta
        </a>

        <div className="flex flex-col gap-2 border-t border-line pt-2 mt-1">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-xs font-bold text-muted">Rastreio</span>
            <button
              type="button"
              onClick={refreshTracking}
              disabled={trackingStatus === 'loading'}
              className="text-xs font-semibold text-accent disabled:opacity-50"
            >
              {trackingStatus === 'loading' ? 'Atualizando...' : 'Atualizar'}
            </button>
          </div>

          {code ? (
            <p className="text-sm">
              <span className="font-mono">{code}</span>
              {tracking?.status && (
                <span className="text-muted"> · {TRACKING_STATUS_LABEL[tracking.status] ?? tracking.status}</span>
              )}
            </p>
          ) : trackingStatus === 'loading' && !tracking ? (
            <p className="text-xs text-muted">Carregando rastreio…</p>
          ) : (
            <p className="text-xs text-muted">
              Código de rastreio ainda não disponível. A transportadora costuma liberar após a postagem — toque em
              &quot;Atualizar&quot;.
            </p>
          )}

          {trackingStatus === 'error' && (
            <p className="text-xs text-red-600">Falha ao consultar o rastreio. Tente novamente em instantes.</p>
          )}

          {tracking?.events && tracking.events.length > 0 ? (
            <ol className="flex flex-col gap-2 border-l border-line pl-3 mt-0.5">
              {tracking.events.map((ev, i) => (
                <li key={i} className="relative text-xs">
                  <span
                    className={`absolute -left-[17px] top-1 w-2 h-2 rounded-full ${i === 0 ? 'bg-accent' : 'bg-line'}`}
                  />
                  <span className={i === 0 ? 'font-semibold' : ''}>{ev.description ?? '—'}</span>
                  {ev.location && <span className="text-muted"> · {ev.location}</span>}
                  {ev.date && <span className="block text-muted tabular-nums">{formatEventDate(ev.date)}</span>}
                </li>
              ))}
            </ol>
          ) : (
            code && (
              <p className="text-xs text-muted">
                Sem eventos ainda. Ou{' '}
                <a href={trackingUrl(code)} target="_blank" rel="noreferrer" className="underline">
                  ver no site da transportadora
                </a>
                .
              </p>
            )
          )}
        </div>
      </Wrap>
    )
  }

  return (
    <Wrap bare={bare} gap="gap-3">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-bold">Frete</h2>
        <Button type="button" onClick={handleCalculate} disabled={loading} variant="secondary" size="sm" className="disabled:opacity-50">
          {loading ? 'Calculando...' : 'Calcular frete'}
        </Button>
      </div>

      {error && <p className="text-xs text-red-600">{error}</p>}

      {box && (
        <p className={`text-xs ${box.fits ? 'text-muted' : 'text-amber-600'}`}>
          Caixa: {box.name}
          {!box.fits && ' — os produtos podem não caber nesta caixa; confira antes de gerar a etiqueta.'}
        </p>
      )}

      {preferredMissing && (
        <p className="text-xs text-amber-600">
          A transportadora padrão não cotou este trajeto. As opções abaixo são alternativas — confira antes de gerar a etiqueta.
        </p>
      )}

      {options.length > 0 && (
        <div className="flex flex-col gap-2">
          {options.map((option) => (
            <label
              key={option.id}
              className={`flex items-center gap-3 p-3 rounded-lg border text-sm cursor-pointer ${
                selected?.id === option.id ? 'border-accent bg-accent/5' : 'border-line'
              }`}
            >
              <input type="radio" name="shipping_option" checked={selected?.id === option.id} onChange={() => setSelected(option)} />
              <span className="flex-1">
                <span className="font-semibold">
                  {option.company.name} · {option.name}
                </span>
                <span className="block text-xs text-muted">Prazo: {option.delivery_time} dia(s) úteis</span>
              </span>
              <span className="font-bold tabular-nums">R$ {Number(option.price).toFixed(2).replace('.', ',')}</span>
            </label>
          ))}

          {needsAgency && (
            <p className="text-xs text-red-600">
              A opção selecionada ({selected?.company.name}) exige uma agência de postagem. Em Configurações → Endereço
              da loja, escolha a transportadora {selected?.company.name} e selecione a agência, depois calcule o frete
              de novo.
            </p>
          )}

          <Button type="button" onClick={handlePurchase} disabled={!selected || purchasing || needsAgency} className="disabled:opacity-50 w-fit mt-1">
            {purchasing ? 'Gerando etiqueta...' : 'Comprar e gerar etiqueta'}
          </Button>
          <p className="text-xs text-muted">Isso debita o valor do frete da sua carteira do Melhor Envio.</p>
        </div>
      )}
    </Wrap>
  )
}

// Quando renderizado dentro de outro card (seção "Entrega" do pedido, ver
// OrderForm), `bare` dispensa a moldura própria pra não aninhar card dentro
// de card.
function Wrap({ bare, gap, children }: { bare: boolean; gap: 'gap-2' | 'gap-3'; children: ReactNode }) {
  if (bare) return <section className={`flex flex-col ${gap}`}>{children}</section>
  return (
    <Card as="section" tight className={`flex flex-col ${gap}`}>
      {children}
    </Card>
  )
}
