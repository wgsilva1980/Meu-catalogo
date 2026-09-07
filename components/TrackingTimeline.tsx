'use client'

import { useState } from 'react'
import Button from '@/components/Button'

export type TrackingEvent = { date: string | null; description: string | null; location: string | null }
export type TrackingData = { code: string | null; status: string | null; events: TrackingEvent[] }

const STATUS_LABEL: Record<string, string> = {
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

function formatDate(raw: string | null) {
  if (!raw) return ''
  const d = new Date(raw)
  return Number.isNaN(d.getTime()) ? raw : d.toLocaleString('pt-BR')
}

export default function TrackingTimeline({
  initial,
  refreshUrl,
}: {
  initial: TrackingData
  refreshUrl: string
}) {
  const [data, setData] = useState<TrackingData>(initial)
  const [status, setStatus] = useState<'idle' | 'loading' | 'error'>('idle')

  async function refresh() {
    setStatus('loading')
    try {
      const res = await fetch(refreshUrl, { cache: 'no-store' })
      if (!res.ok) {
        setStatus('error')
        return
      }
      const json = await res.json()
      setData({ code: json.code ?? null, status: json.status ?? null, events: json.events ?? [] })
      setStatus('idle')
    } catch {
      setStatus('error')
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="text-sm">
          {data.code ? (
            <>
              <span className="font-mono">{data.code}</span>
              {data.status && (
                <span className="text-muted"> · {STATUS_LABEL[data.status] ?? data.status}</span>
              )}
            </>
          ) : (
            <span className="text-muted">Código de rastreio ainda não disponível.</span>
          )}
        </div>
        <Button type="button" onClick={refresh} disabled={status === 'loading'} variant="secondary" size="sm" className="disabled:opacity-50">
          {status === 'loading' ? 'Atualizando...' : 'Atualizar'}
        </Button>
      </div>

      {status === 'error' && (
        <p className="text-xs text-danger">Não foi possível atualizar agora. Tente novamente em instantes.</p>
      )}

      {data.events.length > 0 ? (
        <ol className="flex flex-col gap-3 border-l border-line pl-4">
          {data.events.map((ev, i) => (
            <li key={i} className="relative text-sm">
              <span
                className={`absolute -left-[21px] top-1 w-2.5 h-2.5 rounded-full ${
                  i === 0 ? 'bg-accent' : 'bg-line'
                }`}
              />
              <div className={i === 0 ? 'font-semibold' : ''}>{ev.description ?? '—'}</div>
              {ev.location && <div className="text-xs text-muted">{ev.location}</div>}
              {ev.date && <div className="text-xs text-muted tabular-nums">{formatDate(ev.date)}</div>}
            </li>
          ))}
        </ol>
      ) : (
        <p className="text-sm text-muted">
          Assim que a transportadora registrar movimentações, elas aparecem aqui.
        </p>
      )}
    </div>
  )
}
