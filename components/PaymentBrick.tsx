'use client'

import { useEffect, useRef, useState, type ComponentProps } from 'react'
import { useRouter } from 'next/navigation'
import { initMercadoPago, Payment, StatusScreen } from '@mercadopago/sdk-react'

type Props = {
  token: string
  publicKey: string
  amount: number
  payer: {
    email: string | null
    firstName: string | null
    identification: { type: 'CPF' | 'CNPJ'; number: string } | null
  }
}

type Result = { paymentId: string; status: 'pending' | 'rejected' }

export default function PaymentBrick({ token, publicKey, amount, payer }: Props) {
  const router = useRouter()
  const [ready, setReady] = useState(false)
  const [result, setResult] = useState<Result | null>(null)
  const [formError, setFormError] = useState<string | null>(null)
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // Cada loja conectada tem a própria public_key (modelo marketplace) — não
  // dá pra chamar isso uma vez só no topo do app como os exemplos padrão do
  // Mercado Pago assumem, precisa ser por instância deste componente.
  useEffect(() => {
    initMercadoPago(publicKey, { locale: 'pt-BR' })
    setReady(true)
  }, [publicKey])

  // Pix fica pendente até o webhook confirmar — só então `paid_at` é setado.
  // O Status Screen Brick mostra o QR/status, mas quem decide que terminou é
  // este polling, lendo o que o webhook já gravou no banco.
  useEffect(() => {
    if (result?.status !== 'pending') return
    pollRef.current = setInterval(async () => {
      try {
        const res = await fetch(`/api/acompanhar/${token}/status`)
        const data = await res.json()
        if (data.paid) {
          if (pollRef.current) clearInterval(pollRef.current)
          router.refresh()
        }
      } catch {
        // tenta de novo no próximo tick
      }
    }, 4000)
    return () => {
      if (pollRef.current) clearInterval(pollRef.current)
    }
  }, [result, token, router])

  if (!ready) return null

  if (result) {
    return (
      <div className="flex flex-col gap-3">
        <StatusScreen
          initialization={{ paymentId: result.paymentId }}
          // O Brick monta isso com `new URL(...)` internamente — um path
          // relativo (`/acompanhar/...`) quebra com "Failed to construct
          // 'URL': Invalid URL" e a tela de status trava no carregamento.
          // Só roda no cliente (depois de `ready`), então `window` existe.
          customization={{ backUrls: { return: `${window.location.origin}/acompanhar/${token}` } }}
        />
        {result.status === 'rejected' && (
          <button type="button" onClick={() => setResult(null)} className="text-xs text-muted underline text-center">
            Tentar com outro pagamento
          </button>
        )}
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-1">
      {formError && <p className="text-xs text-red-600">{formError}</p>}
      <Payment
        initialization={{
          amount,
          payer: {
            email: payer.email ?? undefined,
            firstName: payer.firstName ?? undefined,
            identification: payer.identification ?? undefined,
            // Sem isso o Brick reclama ("entityType only receives the value
            // individual or association") — CNPJ é pessoa jurídica, o resto
            // (CPF ou sem documento ainda) é pessoa física.
            entityType: payer.identification?.type === 'CNPJ' ? 'association' : 'individual',
          },
        }}
        // Só cartão e Pix — os outros tipos (`ticket`/boleto, `atm`,
        // `mercadoPago`) ficam de fora por simplesmente não serem declarados
        // aqui. O tipo do SDK só aceita uma chave de cada vez por engano
        // (união em vez de interseção) — na prática o Brick aceita várias.
        customization={
          {
            paymentMethods: { creditCard: 'all', debitCard: 'all', bankTransfer: 'all' },
          } as ComponentProps<typeof Payment>['customization']
        }
        onSubmit={async ({ formData }) => {
          setFormError(null)
          const res = await fetch(`/api/acompanhar/${token}/pagar`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ idempotencyKey: crypto.randomUUID(), formData }),
          })
          const data = await res.json()
          if (!res.ok) {
            const message = data.error ?? 'Não foi possível processar o pagamento agora.'
            setFormError(message)
            throw new Error(message)
          }
          if (data.status === 'approved') {
            router.refresh()
            return
          }
          setResult({ paymentId: data.paymentId, status: data.status })
        }}
      />
    </div>
  )
}
