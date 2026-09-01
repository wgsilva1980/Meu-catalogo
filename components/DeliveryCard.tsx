import type { DeliveryAddress, DeliveryMethod, LalamoveQuote } from '@/lib/types'

const METHOD_LABEL: Record<DeliveryMethod, string> = {
  retirada: 'Retirar na loja',
  motoboy: 'Motoboy',
  a_combinar: 'A combinar',
}

function formatPrice(value: number) {
  return `R$ ${Number(value).toFixed(2).replace('.', ',')}`
}

// Card só-leitura com o endereço e a cotação de entrega que vieram do pedido
// (normalmente do link público). Editar método/valor é pelo formulário acima.
export default function DeliveryCard({
  method,
  fee,
  address,
  quote,
}: {
  method: DeliveryMethod
  fee: number
  address: DeliveryAddress | null
  quote: LalamoveQuote | null
}) {
  const hasDetail = Boolean(address?.zip_code || quote)
  if (!hasDetail && method === 'a_combinar' && fee === 0) return null

  const addressLine = address
    ? [
        [address.street, address.number].filter(Boolean).join(', '),
        address.complement,
        address.neighborhood,
        [address.city, address.state].filter(Boolean).join(' - '),
        address.zip_code ? `CEP ${address.zip_code}` : null,
      ]
        .filter(Boolean)
        .join(' · ')
    : null

  return (
    <section className="flex flex-col gap-2 border border-line rounded-xl p-4">
      <h2 className="text-sm font-bold">Entrega escolhida pelo cliente</h2>
      <p className="text-sm">
        <span className="font-semibold">{METHOD_LABEL[method]}</span>
        {fee > 0 && ` — ${formatPrice(fee)}`}
      </p>
      {addressLine && <p className="text-sm text-muted">{addressLine}</p>}
      {quote && (
        <p className="text-xs text-muted">
          Cotação {quote.provider} · {quote.serviceType}
          {quote.distance_m != null && ` · ~${Math.round(quote.distance_m / 100) / 10} km`}
          {quote.quotedAt && ` · ${new Date(quote.quotedAt).toLocaleString('pt-BR')}`}
        </p>
      )}
    </section>
  )
}
