'use client'

import { useState } from 'react'
import type { ReactNode } from 'react'
import Image from 'next/image'
import { submitPublicOrder } from '@/app/pedido/[slug]/actions'
import type { Category, Customer, DeliveryMethod, Product } from '@/lib/types'
import { formatAddress, formatPrice, isValidZipCode } from '@/lib/format'
import Card from '@/components/Card'
import Button from '@/components/Button'
import Badge from '@/components/Badge'

type ViaCepResponse = {
  erro?: boolean
  logradouro?: string
  bairro?: string
  localidade?: string
  uf?: string
}

type MotoQuote = { fee: number; distanceKm: number | null; quotationId: string; serviceType: string }

type MelhorEnvioOption = {
  id: number
  name: string
  price: string
  delivery_time: number
  company: { id: number; name: string; picture: string }
}

const STEPS = [
  { n: 1, label: 'Produtos' },
  { n: 2, label: 'Entrega' },
  { n: 3, label: 'Pagamento' },
] as const

export default function PublicOrderForm({
  slug,
  categories,
  products,
  foundCustomer,
  typedDocument,
  motoboyEnabled = false,
  melhorEnvioEnabled = false,
  paymentMethods = [],
}: {
  slug: string
  categories: Category[]
  products: Product[]
  foundCustomer: Customer | null
  typedDocument: string | null
  motoboyEnabled?: boolean
  melhorEnvioEnabled?: boolean
  paymentMethods?: { id: string; name: string }[]
}) {
  const [step, setStep] = useState<1 | 2 | 3>(1)
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

  // Cliente já tem endereço cadastrado: mostra ele pronto em vez de pedir
  // para preencher tudo de novo. Só abre os campos se ele quiser mudar.
  const hasSavedAddress = Boolean(foundCustomer?.zip_code)
  const [editingAddress, setEditingAddress] = useState(!hasSavedAddress)

  const [quote, setQuote] = useState<MotoQuote | null>(null)
  const [quoteStatus, setQuoteStatus] = useState<'idle' | 'loading' | 'error'>('idle')
  const [quoteError, setQuoteError] = useState<string | null>(null)

  const [meOptions, setMeOptions] = useState<MelhorEnvioOption[]>([])
  const [meSelected, setMeSelected] = useState<MelhorEnvioOption | null>(null)
  const [meStatus, setMeStatus] = useState<'idle' | 'loading' | 'error'>('idle')
  const [meError, setMeError] = useState<string | null>(null)

  const productsTotal = products.reduce((sum, p) => sum + (quantities[p.id] || 0) * Number(p.price), 0)
  const itemCount = Object.values(quantities).reduce((sum, q) => sum + (q > 0 ? q : 0), 0)
  const deliveryFee =
    method === 'motoboy' && quote ? quote.fee : method === 'melhor_envio' && meSelected ? Number(meSelected.price) : 0
  const total = productsTotal + deliveryFee

  const groups = categories
    .map((category) => ({ category, items: products.filter((p) => p.category_id === category.id) }))
    .filter((g) => g.items.length > 0)

  function setQuantity(productId: string, value: number) {
    setQuantities((q) => ({ ...q, [productId]: Math.max(0, value) }))
    // o carrinho mudou: qualquer cotação de frete por peso/CEP fica inválida
    setMeOptions([])
    setMeSelected(null)
    setMeError(null)
  }

  function updateAddr(patch: Partial<typeof addr>) {
    setAddr((a) => ({ ...a, ...patch }))
    // qualquer mudança de endereço invalida a cotação anterior
    setQuote(null)
    setQuoteError(null)
    setMeOptions([])
    setMeSelected(null)
    setMeError(null)
  }

  function selectMethod(next: DeliveryMethod) {
    setMethod(next)
    setQuoteError(null)
    setMeError(null)
    if (next !== 'motoboy') setQuote(null)
    if (next !== 'melhor_envio') {
      setMeOptions([])
      setMeSelected(null)
    }
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

  async function calculateMelhorEnvio() {
    setMeStatus('loading')
    setMeError(null)
    setMeOptions([])
    setMeSelected(null)
    try {
      const items = Object.entries(quantities)
        .filter(([, qty]) => qty > 0)
        .map(([product_id, quantity]) => ({ product_id, quantity }))
      const res = await fetch(`/api/pedido/${slug}/entrega/melhor-envio`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ zip_code: addr.zip_code, items }),
      })
      const data = await res.json()
      if (!res.ok) {
        setMeStatus('error')
        setMeError(data.error ?? 'Não foi possível calcular o frete.')
        return
      }
      const options: MelhorEnvioOption[] = data.options ?? []
      setMeOptions(options)
      setMeSelected(options[0] ?? null)
      setMeStatus('idle')
    } catch {
      setMeStatus('error')
      setMeError('Não foi possível calcular o frete.')
    }
  }

  const canCalculate = isValidZipCode(addr.zip_code) && quoteStatus !== 'loading'
  const canCalculateMe = isValidZipCode(addr.zip_code) && meStatus !== 'loading' && itemCount > 0

  const canAdvanceToDelivery = itemCount > 0
  const canAdvanceToPayment =
    method === 'motoboy' ? Boolean(quote) : method === 'melhor_envio' ? Boolean(meSelected) : true
  const blockSubmit = !canAdvanceToDelivery || !canAdvanceToPayment

  // Trava de segurança: o formulário só pode ser enviado de fato quando o
  // cliente chegou à última fase com os dados válidos. Sem isso, qualquer
  // envio implícito do navegador (ex.: confirmar um <select> no teclado do
  // celular) usa o único botão type="submit" do formulário e finaliza o
  // pedido nas fases anteriores, sem o cliente ter clicado em nada.
  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    if (step !== 3 || blockSubmit) {
      e.preventDefault()
    }
  }

  return (
    <form action={submitPublicOrder} onSubmit={handleSubmit} className="flex flex-col gap-4">
      <input type="hidden" name="slug" value={slug} />
      <div aria-hidden="true" style={{ position: 'absolute', left: '-9999px', width: 1, height: 1, overflow: 'hidden' }}>
        <label>
          Não preencha este campo
          <input type="text" name="company_website" tabIndex={-1} autoComplete="off" defaultValue="" />
        </label>
      </div>

      <StepHeader step={step} />

      <section className={`flex flex-col gap-5 ${step === 1 ? '' : 'hidden'}`}>
        {groups.map(({ category, items }) => (
          <div key={category.id} className="flex flex-col gap-2">
            <h2 className="text-sm font-bold">{category.name}</h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {items.map((p) => (
                <ProductCard key={p.id} product={p} quantity={quantities[p.id] ?? 0} onChange={(qty) => setQuantity(p.id, qty)} />
              ))}
            </div>
          </div>
        ))}
        {products.length === 0 && <p className="text-sm text-muted">Nenhum produto disponível no momento.</p>}

        <CartSummary itemCount={itemCount} productsTotal={productsTotal} />
      </section>

      <section className={`flex flex-col gap-4 ${step === 2 ? '' : 'hidden'}`}>
        <Card as="section" tight className="flex flex-col gap-3">
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
            {melhorEnvioEnabled && (
              <MethodOption
                checked={method === 'melhor_envio'}
                onChange={() => selectMethod('melhor_envio')}
                label="Envio pelos Correios/transportadora"
                hint="Calculamos o frete pelo seu CEP"
              />
            )}
            <MethodOption
              checked={method === 'a_combinar'}
              onChange={() => selectMethod('a_combinar')}
              label="Combinar depois"
              hint="A loja entra em contato para acertar a entrega"
            />
          </div>

          {(method === 'motoboy' || method === 'melhor_envio') && (
            hasSavedAddress && !editingAddress ? (
              <div className="flex flex-col gap-2 border-t border-line pt-3">
                <p className="text-xs font-semibold text-muted">Endereço de entrega</p>
                <p className="text-sm">{formatAddress(addr)}</p>
                <button
                  type="button"
                  onClick={() => setEditingAddress(true)}
                  className="text-xs font-semibold text-accent underline w-fit"
                >
                  Entregar em outro endereço
                </button>
                <input type="hidden" name="zip_code" value={addr.zip_code} />
                <input type="hidden" name="street" value={addr.street} />
                <input type="hidden" name="number" value={addr.number} />
                <input type="hidden" name="complement" value={addr.complement} />
                <input type="hidden" name="neighborhood" value={addr.neighborhood} />
                <input type="hidden" name="city" value={addr.city} />
                <input type="hidden" name="state" value={addr.state} />
              </div>
            ) : (
              <AddressFields addr={addr} updateAddr={updateAddr} cepStatus={cepStatus} onZipChange={handleZipChange} />
            )
          )}

          {method === 'motoboy' && (
            <div className="flex flex-col gap-3 border-t border-line pt-3">
              <div className="flex flex-wrap items-center gap-3">
                <Button
                  type="button"
                  onClick={calculateMoto}
                  disabled={!canCalculate}
                  variant="secondary"
                  size="sm"
                  className="disabled:opacity-50"
                >
                  {quoteStatus === 'loading' ? 'Calculando...' : 'Calcular entrega'}
                </Button>
                {quote && (
                  <span className="text-sm font-semibold text-green-700">
                    Motoboy: {formatPrice(quote.fee)}
                    {quote.distanceKm != null ? ` · ~${quote.distanceKm} km` : ''}
                  </span>
                )}
              </div>
              {quoteError && <p className="text-xs text-red-600">{quoteError}</p>}
              {!quote && !quoteError && (
                <p className="text-xs text-muted">Calcule a entrega para conseguir avançar com motoboy.</p>
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

          {method === 'melhor_envio' && (
            <div className="flex flex-col gap-3 border-t border-line pt-3">
              <div className="flex flex-wrap items-center gap-3">
                <Button
                  type="button"
                  onClick={calculateMelhorEnvio}
                  disabled={!canCalculateMe}
                  variant="secondary"
                  size="sm"
                  className="disabled:opacity-50"
                >
                  {meStatus === 'loading' ? 'Calculando...' : 'Calcular frete'}
                </Button>
              </div>
              {meError && <p className="text-xs text-red-600">{meError}</p>}
              {meOptions.length === 0 && !meError && (
                <p className="text-xs text-muted">Calcule o frete para ver as opções de envio.</p>
              )}

              {meOptions.length > 0 && (
                <div className="flex flex-col gap-2">
                  {meOptions.map((option) => (
                    <label
                      key={option.id}
                      className={`flex items-center gap-3 p-3 rounded-lg border text-sm cursor-pointer ${
                        meSelected?.id === option.id ? 'border-accent bg-accent/5' : 'border-line'
                      }`}
                    >
                      <input
                        type="radio"
                        checked={meSelected?.id === option.id}
                        onChange={() => setMeSelected(option)}
                      />
                      <span className="flex-1">
                        <span className="font-semibold block">
                          {option.company.name} · {option.name}
                        </span>
                        <span className="block text-xs text-muted">Prazo: {option.delivery_time} dia(s) úteis</span>
                      </span>
                      <span className="font-bold tabular-nums">{formatPrice(Number(option.price))}</span>
                    </label>
                  ))}
                </div>
              )}

              {meSelected && (
                <input type="hidden" name="melhor_envio_service_id" value={meSelected.id} />
              )}
            </div>
          )}
        </Card>

        <CartSummary itemCount={itemCount} productsTotal={productsTotal} deliveryFee={deliveryFee} deliveryLabel={method === 'motoboy' ? 'Entrega (motoboy)' : method === 'melhor_envio' ? 'Frete' : undefined} />
      </section>

      <section className={`flex flex-col gap-4 ${step === 3 ? '' : 'hidden'}`}>
        {paymentMethods.length > 0 && (
          <Card as="section" tight className="flex flex-col gap-3">
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
          </Card>
        )}

        {foundCustomer ? (
          <Card as="section" tight className="flex flex-col gap-2">
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
          </Card>
        ) : (
          <Card as="section" tight className="flex flex-col gap-3">
            <h2 className="text-sm font-bold">Seus dados</h2>
            {typedDocument && <input type="hidden" name="document" value={typedDocument} />}
            <Field label="Nome">
              <input name="name" required={step === 3} className="input" />
            </Field>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Field label="Telefone/WhatsApp">
                <input name="phone" required={step === 3} placeholder="(00) 00000-0000" className="input" />
              </Field>
              <Field label="E-mail">
                <input name="email" type="email" className="input" />
              </Field>
            </div>
            <Field label="Observações">
              <textarea name="notes" className="input h-20" />
            </Field>
          </Card>
        )}

        <CartSummary itemCount={itemCount} productsTotal={productsTotal} deliveryFee={deliveryFee} deliveryLabel={method === 'motoboy' ? 'Entrega (motoboy)' : method === 'melhor_envio' ? 'Frete' : undefined} />
      </section>

      <div className="flex items-center justify-between gap-3 border-t border-line pt-3">
        {step > 1 ? (
          <Button type="button" onClick={() => setStep((s) => (s - 1) as 1 | 2 | 3)} variant="secondary">
            Voltar
          </Button>
        ) : (
          <span />
        )}

        {step < 3 ? (
          <Button
            key="continue"
            type="button"
            onClick={() => setStep((s) => (s + 1) as 1 | 2 | 3)}
            disabled={step === 1 ? !canAdvanceToDelivery : !canAdvanceToPayment}
            className="disabled:opacity-40"
          >
            Continuar
          </Button>
        ) : (
          <Button key="submit" type="submit" disabled={blockSubmit} className="disabled:opacity-40">
            Enviar pedido
          </Button>
        )}
      </div>
    </form>
  )
}

function StepHeader({ step }: { step: 1 | 2 | 3 }) {
  return (
    <div className="flex items-center justify-between gap-2">
      {STEPS.map(({ n, label }, i) => (
        <div key={n} className="flex items-center flex-1 last:flex-none">
          <div className="flex flex-col items-center gap-1">
            <span
              className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${
                n === step ? 'bg-accent text-white' : n < step ? 'bg-accent/20 text-accent' : 'bg-paper text-muted border border-line'
              }`}
            >
              {n}
            </span>
            <span className={`text-[11px] font-semibold ${n === step ? 'text-ink' : 'text-muted'}`}>{label}</span>
          </div>
          {i < STEPS.length - 1 && (
            <div className={`h-px flex-1 mx-2 ${n < step ? 'bg-accent/40' : 'bg-line'}`} />
          )}
        </div>
      ))}
    </div>
  )
}

function CartSummary({
  itemCount,
  productsTotal,
  deliveryFee = 0,
  deliveryLabel,
}: {
  itemCount: number
  productsTotal: number
  deliveryFee?: number
  deliveryLabel?: string
}) {
  return (
    <div className="flex flex-col gap-1 border-t border-line pt-3 text-sm">
      <div className="flex justify-between text-muted">
        <span>
          {itemCount} {itemCount === 1 ? 'item' : 'itens'}
        </span>
        <span>{formatPrice(productsTotal)}</span>
      </div>
      {deliveryFee > 0 && (
        <div className="flex justify-between text-muted">
          <span>{deliveryLabel ?? 'Entrega'}</span>
          <span>{formatPrice(deliveryFee)}</span>
        </div>
      )}
      <div className="flex justify-between font-bold">
        <span>Total</span>
        <span>{formatPrice(productsTotal + deliveryFee)}</span>
      </div>
    </div>
  )
}

function AddressFields({
  addr,
  updateAddr,
  cepStatus,
  onZipChange,
}: {
  addr: {
    zip_code: string
    street: string
    number: string
    complement: string
    neighborhood: string
    city: string
    state: string
  }
  updateAddr: (patch: Partial<typeof addr>) => void
  cepStatus: 'idle' | 'loading' | 'not-found' | 'error'
  onZipChange: (e: React.ChangeEvent<HTMLInputElement>) => void
}) {
  return (
    <div className="flex flex-col gap-3 border-t border-line pt-3">
      <div className="flex items-end gap-3">
        <Field label="CEP">
          <input
            name="zip_code"
            value={addr.zip_code}
            onChange={onZipChange}
            placeholder="00000-000"
            inputMode="numeric"
            maxLength={9}
            className="input max-w-[10rem]"
          />
        </Field>
        <span role="status" aria-live="polite">
          {cepStatus === 'loading' && <span className="text-xs text-muted pb-2">Buscando endereço...</span>}
          {cepStatus === 'not-found' && <span className="text-xs text-red-600 pb-2">CEP não encontrado.</span>}
          {cepStatus === 'error' && <span className="text-xs text-red-600 pb-2">Falha ao buscar o CEP.</span>}
        </span>
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
    </div>
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

// Card de vitrine: antes cada produto era uma linha de texto com uma thumb
// de 40px — aqui virou o protagonista (foto grande, 1:1) com um stepper de
// quantidade em vez de um <input type="number"> nu, que no celular abre o
// teclado inteiro só pra escolher "2". O <input> continua existindo (nome
// "quantity", é ele que a submissão do form lê) só que sem as setas nativas,
// espremido entre os botões − e +.
function ProductCard({
  product,
  quantity,
  onChange,
}: {
  product: Product
  quantity: number
  onChange: (quantity: number) => void
}) {
  return (
    <div className="flex flex-col overflow-hidden rounded-xl border border-line bg-white">
      <div className="relative aspect-square bg-paper">
        {product.image_url ? (
          <Image
            src={product.image_url}
            alt={`${product.name} — ${product.brand}`}
            fill
            sizes="(min-width: 640px) 200px, 45vw"
            className="object-cover"
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center text-muted text-xs text-center p-2">Sem foto</div>
        )}
        {product.promo_note && (
          <Badge variant="promo" size="sm" className="absolute top-1.5 left-1.5 shadow-sm">
            {product.promo_note}
          </Badge>
        )}
      </div>
      <div className="flex flex-col gap-2 p-2.5">
        <div className="min-w-0">
          <p className="font-semibold text-sm truncate">{product.name}</p>
          <p className="text-xs text-muted truncate">{product.brand}</p>
          <p className="font-bold text-sm mt-0.5">{formatPrice(product.price)}</p>
        </div>

        <input type="hidden" name="product_id" value={product.id} />
        <div className="flex items-center justify-between gap-1">
          <button
            type="button"
            onClick={() => onChange(Math.max(0, quantity - 1))}
            disabled={quantity <= 0}
            aria-label={`Diminuir quantidade de ${product.name}`}
            className="w-8 h-8 shrink-0 flex items-center justify-center rounded-lg border border-line text-base font-bold disabled:opacity-30 disabled:cursor-not-allowed"
          >
            −
          </button>
          <input
            name="quantity"
            type="number"
            min={0}
            value={quantity}
            onChange={(e) => onChange(Math.max(0, Number(e.target.value)))}
            aria-label={`Quantidade de ${product.name}`}
            className="w-full min-w-0 text-center text-sm font-semibold border-0 bg-transparent focus:outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
          />
          <button
            type="button"
            onClick={() => onChange(quantity + 1)}
            aria-label={`Aumentar quantidade de ${product.name}`}
            className="w-8 h-8 shrink-0 flex items-center justify-center rounded-lg border border-line text-base font-bold"
          >
            +
          </button>
        </div>
      </div>
    </div>
  )
}
