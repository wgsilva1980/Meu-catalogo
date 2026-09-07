'use client'

import { useEffect, useRef, useState, type ComponentProps } from 'react'
import { useRouter } from 'next/navigation'
import { initMercadoPago, Payment, StatusScreen } from '@mercadopago/sdk-react'
import Alert from '@/components/Alert'

type Props = {
  token: string
  publicKey: string
  amount: number
  // Já calculado no servidor a partir do total do pedido e do valor mínimo
  // de parcela configurado pela loja (Configurações > Mercado Pago).
  maxInstallments: number
  // Pix criado numa visita anterior que ainda não confirmou — retoma a tela
  // de status em vez de mostrar o formulário do zero (senão dá pra gerar um
  // segundo Pix pro mesmo pedido sem querer).
  pendingPayment: { paymentId: string } | null
  payer: {
    email: string | null
    firstName: string | null
    identification: { type: 'CPF' | 'CNPJ'; number: string } | null
  }
}

type Result = { paymentId: string; status: 'pending' | 'rejected' }

export default function PaymentBrick({ token, publicKey, amount, maxInstallments, pendingPayment, payer }: Props) {
  const router = useRouter()
  const [ready, setReady] = useState(false)
  const [result, setResult] = useState<Result | null>(
    pendingPayment ? { paymentId: pendingPayment.paymentId, status: 'pending' } : null
  )
  const [formError, setFormError] = useState<string | null>(null)
  const [pixExpired, setPixExpired] = useState(false)
  const pollRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Cada loja conectada tem a própria public_key (modelo marketplace) — não
  // dá pra chamar isso uma vez só no topo do app como os exemplos padrão do
  // Mercado Pago assumem, precisa ser por instância deste componente.
  useEffect(() => {
    initMercadoPago(publicKey, { locale: 'pt-BR' })
    setReady(true)
  }, [publicKey])

  // Pix fica pendente até o webhook confirmar — só então `paid_at` é setado.
  // O Status Screen Brick mostra o QR/status, mas quem decide que terminou é
  // este polling, lendo o que o webhook já gravou no banco. Some vez com
  // frequência maior (4s) nos primeiros ~2min, depois cai pra 15s — e para
  // de vez depois de 30min, senão um cliente que abandona a aba fica
  // sondando o servidor pra sempre.
  useEffect(() => {
    if (result?.status !== 'pending') return
    setPixExpired(false)
    const startedAt = Date.now()
    const MAX_POLL_MS = 30 * 60 * 1000
    let cancelled = false

    const tick = async (attempt: number) => {
      if (cancelled) return
      if (Date.now() - startedAt > MAX_POLL_MS) {
        setPixExpired(true)
        return
      }
      try {
        const res = await fetch(`/api/acompanhar/${token}/status`)
        const data = await res.json()
        if (data.paid) {
          router.refresh()
          return
        }
      } catch {
        // tenta de novo no próximo tick
      }
      if (cancelled) return
      pollRef.current = setTimeout(() => tick(attempt + 1), attempt < 30 ? 4000 : 15000)
    }
    tick(0)

    return () => {
      cancelled = true
      if (pollRef.current) clearTimeout(pollRef.current)
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
        <div role="status" aria-live="polite">
          {pixExpired && (
            <Alert variant="warning" size="sm" center>
              Paramos de checar automaticamente. Se você já pagou, atualize a página — se ainda não, o código pode ter
              expirado.
            </Alert>
          )}
        </div>
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
      <div role="status" aria-live="polite">
        {formError && <p className="text-xs text-red-600">{formError}</p>}
      </div>
      <Payment
        // O SDK loga o BIN do cartão no console por padrão quando essa prop
        // não é passada (`onBinChangeDefault` em @mercadopago/sdk-react) — só
        // os 8 primeiros dígitos, não sensível por si só, mas sem motivo pra
        // aparecer no console do comprador.
        onBinChange={() => {}}
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
        // `maxInstallments` já vem calculado do servidor (total do pedido ÷
        // valor mínimo de parcela que a loja configurou) — não é um teto
        // fixo igual pra qualquer valor de pedido.
        customization={
          {
            paymentMethods: { creditCard: 'all', debitCard: 'all', bankTransfer: 'all', maxInstallments },
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
