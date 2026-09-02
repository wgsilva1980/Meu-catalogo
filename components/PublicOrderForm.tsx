'use client'

import { useState } from 'react'
import type { ReactNode } from 'react'
import { submitPublicOrder } from '@/app/pedido/[slug]/actions'
import type { Category, Customer, DeliveryMethod, Product } from '@/lib/types'

function formatPrice(value: number) {
  return `R$ ${Number(value).toFixed(2).replace('.', ',')}`
}

type ViaCepResponse = {
  erro?: boolean
  logradouro?: string
  bairro?: string
  localidade?: string
  uf?: string
}

type MotoQuote = { fee: number; distanceKm: number | null; quotationId: string; serviceType: string }

export default function PublicOrderForm({
  slug,
  categories,
  products,
  foundCustomer,
  typedDocument,
  motoboyEnabled = false,
  paymentMethods = [],
}: {
  slug: string
  categories: Category[]
  products: Product[]
  foundCustomer: Customer | null
  typedDocument: string | null
  motoboyEnabled?: boolean
  paymentMethods?: { id: string; name: string }[]
}) {
  const [quantities, setQuantities] = useState<Record<string, number>>({})

  const [method, setMethod] = useState<DeliveryMethod>('a_combinar')
  const [addr, setAddr] = useState({
    zip_code: foundCustomer?.zip_code ?? '',
    street: foundCustomer?.street ?? '',
    number: foundCustomer?.number ?? '',
    complement: foundCustomer?.complement ?? '',
    neighborhood: foundCustomer?.neighborhood ?? '',
    city: foundCustomer?.city ?? '',
    state: foundCustomer?.state ?? '',
  })
  const [cepStatus, setCepStatus] = useState<'idle' | 'loading' | 'not-found' | 'error'>('idle')
  const [quote, setQuote] = useState<MotoQuote | null>(null)
  const [quoteStatus, setQuoteStatus] = useState<'idle' | 'loading' | 'error'>('idle')
  const [quoteError, setQuoteError] = useState<string | null>(null)

  const productsTotal = products.reduce((sum, p) => sum + (quantities[p.id] || 0) * Number(p.price), 0)
  const itemCount = Object.values(quantities).reduce((sum, q) => sum + (q > 0 ? q : 0), 0)
  const deliveryFee = method === 'motoboy' && quote ? quote.fee : 0
  const total = productsTotal + deliveryFee

  const groups = categories
    .map((category) => ({ category, items: products.filter((p) => p.category_id === category.id) }))
    .filter((g) => g.items.length > 0)

  function updateAddr(patch: Partial<typeof addr>) {
    setAddr((a) => ({ ...a, ...patch }))
    // qualquer mudança de endereço invalida a cotação anterior
    setQuote(null)
    setQuoteError(null)
  }

  function selectMethod(next: DeliveryMethod) {
    setMethod(next)
    setQuoteError(null)
    if (next !== 'motoboy') setQuote(null)
  }

  async function handleZipChange(e: React.ChangeEvent<HTMLInputElement>) {
    const raw = e.target.value
    updateAddr({ zip_code: raw })
    const digits = raw.replace(/\D/g, '')
    if (digits.length !== 8) {
      setCepStatus('idle')
      return
    }
    setCepStatus('loading')
    try {
      const res = await fetch(`https://viacep.com.br/ws/${digits}/json/`)
      const data: ViaCepResponse = await res.json()
      if (data.erro) {
        setCepStatus('not-found')
        return
      }
      setAddr((a) => ({
        ...a,
        street: data.logradouro || a.street,
        neighborhood: data.bairro || a.neighborhood,
        city: data.localidade || a.city,
        state: data.uf || a.state,
      }))
      setCepStatus('idle')
    } catch {
      setCepStatus('error')
    }
  }

  async function calculateMoto() {
    setQuoteStatus('loading')
    setQuoteError(null)
    setQuote(null)
    try {
      const res = await fetch(`/api/pedido/${slug}/entrega/motoboy`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(addr),
      })
      const data = await res.json()
      if (!res.ok) {
        setQuoteStatus('error')
        setQuoteError(data.error ?? 'Não foi possível calcular a entrega.')
        return
      }
      setQuote({ fee: data.fee, distanceKm: data.distanceKm, quotationId: data.quotationId, serviceType: data.serviceType })
      setQuoteStatus('idle')
    } catch {
      setQuoteStatus('error')
      setQuoteError('Não foi possível calcular a entrega.')
    }
  }

  const canCalculate = addr.zip_code.replace(/\D/g, '').length === 8 && quoteStatus !== 'loading'
  const blockSubmit = itemCount === 0 || (method === 'motoboy' && !quote)

  return (
    <form action={submitPublicOrder} className="flex flex-col gap-4">
      <input type="hidden" name="slug" value={slug} />
      <div aria-hidden="true" style={{ position: 'absolute', left: '-9999px', width: 1, height: 1, overflow: 'hidden' }}>
        <label>
          Não preencha este campo
          <input type="text" name="company_website" tabIndex={-1} autoComplete="off" defaultValue="" />
        </label>
      </div>

      <section className="flex flex-col gap-4">
        {groups.map(({ category, items }) => (
          <div key={category.id} className="flex flex-col gap-2">
            <h2 className="text-sm font-bold">{category.name}</h2>
            <div className="flex flex-col divide-y divide-line border border-line rounded-lg overflow-hidden">
              {items.map((p) => (
                <div key={p.id} className="flex items-center gap-3 p-3 text-sm">
                  <div className="w-10 h-10 rounded-md bg-paper border border-line shrink-0 overflow-hidden">
                    {p.image_url && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={p.image_url} className="w-full h-full object-cover" alt="" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold truncate">{p.name}</p>
                    <p className="text-xs text-muted truncate">
                      {p.brand} · {formatPrice(p.price)}
                    </p>
                  </div>
                  <input type="hidden" name="product_id" value={p.id} />
                  <input
                    name="quantity"
                    type="number"
                    min={0}
                    value={quantities[p.id] ?? 0}
                    onChange={(e) =>
                      setQuantities((q) => ({ ...q, [p.id]: Math.max(0, Number(e.target.value)) }))
                    }
                    className="input w-16 text-center shrink-0"
                  />
                </div>
              ))}
            </div>
          </div>
        ))}
        {products.length === 0 && <p className="text-sm text-muted">Nenhum produto disponível no momento.</p>}
      </section>

      <section className="flex flex-col gap-3 border border-line rounded-xl p-4">
        <h2 className="text-sm font-bold">Entrega</h2>
        <input type="hidden" name="delivery_method" value={method} />

        <div className="flex flex-col gap-2">
          <MethodOption checked={method === 'retirada'} onChange={() => selectMethod('retirada')} label="Retirar na loja" hint="Sem custo de entrega" />
          {motoboyEnabled && (
            <MethodOption
              checked={method === 'motoboy'}
              onChange={() => selectMethod('motoboy')}
              label="Motoboy — entrega rápida"
              hint="Valor calculado pelo seu endereço"
            />
          )}
          <MethodOption
            checked={method === 'a_combinar'}
            onChange={() => selectMethod('a_combinar')}
            label="Combinar depois"
            hint="A loja entra em contato para acertar a entrega"
          />
        </div>

        {method === 'motoboy' && (
          <div className="flex flex-col gap-3 border-t border-line pt-3">
            <div className="flex items-end gap-3">
              <Field label="CEP">
                <input
                  name="zip_code"
                  value={addr.zip_code}
                  onChange={handleZipChange}
                  placeholder="00000-000"
                  inputMode="numeric"
                  maxLength={9}
                  className="input max-w-[10rem]"
                />
              </Field>
              {cepStatus === 'loading' && <span className="text-xs text-muted pb-2">Buscando endereço...</span>}
              {cepStatus === 'not-found' && <span className="text-xs text-red-600 pb-2">CEP não encontrado.</span>}
              {cepStatus === 'error' && <span className="text-xs text-red-600 pb-2">Falha ao buscar o CEP.</span>}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-[1fr_7rem] gap-3">
              <Field label="Rua">
                <input name="street" value={addr.street} onChange={(e) => updateAddr({ street: e.target.value })} className="input" />
              </Field>
              <Field label="Número">
                <input name="number" value={addr.number} onChange={(e) => updateAddr({ number: e.target.value })} className="input" />
              </Field>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Field label="Complemento">
                <input name="complement" value={addr.complement} onChange={(e) => updateAddr({ complement: e.target.value })} className="input" />
              </Field>
              <Field label="Bairro">
                <input name="neighborhood" value={addr.neighborhood} onChange={(e) => updateAddr({ neighborhood: e.target.value })} className="input" />
              </Field>
            </div>
            <div className="grid grid-cols-[1fr_5rem] gap-3">
              <Field label="Cidade">
                <input name="city" value={addr.city} onChange={(e) => updateAddr({ city: e.target.value })} className="input" />
              </Field>
              <Field label="UF">
                <input
                  name="state"
                  value={addr.state}
                  onChange={(e) => updateAddr({ state: e.target.value.toUpperCase() })}
                  maxLength={2}
                  className="input"
                />
              </Field>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={calculateMoto}
                disabled={!canCalculate}
                className="border border-line rounded-lg px-3 py-1.5 text-xs font-semibold disabled:opacity-50"
              >
                {quoteStatus === 'loading' ? 'Calculando...' : 'Calcular entrega'}
              </button>
              {quote && (
                <span className="text-sm font-semibold text-green-700">
                  Motoboy: {formatPrice(quote.fee)}
                  {quote.distanceKm != null ? ` · ~${quote.distanceKm} km` : ''}
                </span>
              )}
            </div>
            {quoteError && <p className="text-xs text-red-600">{quoteError}</p>}
            {!quote && !quoteError && (
              <p className="text-xs text-muted">Calcule a entrega para conseguir enviar o pedido com motoboy.</p>
            )}

            {quote && (
              <>
                <input type="hidden" name="delivery_fee" value={quote.fee} />
                <input
                  type="hidden"
                  name="delivery_quote"
                  value={JSON.stringify({ quotationId: quote.quotationId, serviceType: quote.serviceType })}
                />
              </>
            )}
          </div>
        )}
      </section>

      {paymentMethods.length > 0 && (
        <section className="flex flex-col gap-3 border border-line rounded-xl p-4">
          <h2 className="text-sm font-bold">Forma de pagamento</h2>
          <Field label="Como você prefere pagar?">
            <select name="payment_method_id" defaultValue="" className="input">
              <option value="">Combinar com a loja</option>
              {paymentMethods.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
            </select>
          </Field>
        </section>
      )}

      <div className="flex flex-col gap-1 border-t border-line pt-3 text-sm">
        <div className="flex justify-between text-muted">
          <span>
            {itemCount} {itemCount === 1 ? 'item' : 'itens'}
          </span>
          <span>{formatPrice(productsTotal)}</span>
        </div>
        {deliveryFee > 0 && (
          <div className="flex justify-between text-muted">
            <span>Entrega (motoboy)</span>
            <span>{formatPrice(deliveryFee)}</span>
          </div>
        )}
        <div className="flex justify-between font-bold">
          <span>Total</span>
          <span>{formatPrice(total)}</span>
        </div>
      </div>

      {foundCustomer ? (
        <section className="flex flex-col gap-2 border border-line rounded-xl p-4">
          <input type="hidden" name="customer_id" value={foundCustomer.id} />
          <h2 className="text-sm font-bold">Seus dados</h2>
          <p className="text-sm">
            Cadastro encontrado: <span className="font-semibold">{foundCustomer.name}</span>
          </p>
          <a href={`/pedido/${slug}`} className="text-xs text-accent underline w-fit">
            Não é você? Buscar outro CPF
          </a>
          <Field label="Observações">
            <textarea name="notes" className="input h-20" />
          </Field>
        </section>
      ) : (
        <section className="flex flex-col gap-3 border border-line rounded-xl p-4">
          <h2 className="text-sm font-bold">Seus dados</h2>
          {typedDocument && <input type="hidden" name="document" value={typedDocument} />}
          <Field label="Nome">
            <input name="name" required className="input" />
          </Field>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Field label="Telefone/WhatsApp">
              <input name="phone" required placeholder="(00) 00000-0000" className="input" />
            </Field>
            <Field label="E-mail">
              <input name="email" type="email" className="input" />
            </Field>
          </div>
          <Field label="Observações">
            <textarea name="notes" className="input h-20" />
          </Field>
        </section>
      )}

      <button
        type="submit"
        disabled={blockSubmit}
        className="bg-accent text-white rounded-lg px-4 py-2 text-sm font-bold disabled:opacity-40"
      >
        Enviar pedido
      </button>
    </form>
  )
}

function MethodOption({
  checked,
  onChange,
  label,
  hint,
}: {
  checked: boolean
  onChange: () => void
  label: string
  hint: string
}) {
  return (
    <label
      className={`flex items-start gap-3 p-3 rounded-lg border text-sm cursor-pointer ${
        checked ? 'border-accent bg-accent/5' : 'border-line'
      }`}
    >
      <input type="radio" name="delivery_method_radio" checked={checked} onChange={onChange} className="mt-0.5" />
      <span>
        <span className="font-semibold block">{label}</span>
        <span className="text-xs text-muted">{hint}</span>
      </span>
    </label>
  )
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="flex flex-col gap-1 text-xs font-semibold text-muted">
      {label}
      {children}
    </label>
  )
}
