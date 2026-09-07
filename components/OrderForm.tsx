'use client'

import { useState } from 'react'
import type { ReactNode } from 'react'
import { saveOrder } from '@/app/admin/pedidos/actions'
import ShippingCard from '@/components/ShippingCard'
import { orderTotal } from '@/lib/orderTotals'
import { formatPrice } from '@/lib/format'
import type {
  Customer,
  DeliveryMethod,
  DiscountType,
  OrderStatus,
  PaymentMethod,
  Product,
  SalesOrder,
  SalesOrderItem,
  Shipment,
} from '@/lib/types'

const DELIVERY_LABELS: Record<DeliveryMethod, string> = {
  retirada: 'Retirar na loja',
  motoboy: 'Motoboy',
  a_combinar: 'A combinar',
  melhor_envio: 'Melhor Envio',
}

type Line = { key: number; product_id: string; quantity: number }

export default function OrderForm({
  order,
  items,
  customers,
  products,
  melhorEnvioConnected = false,
  shipment = null,
  paymentMethods = [],
}: {
  order?: SalesOrder
  items?: SalesOrderItem[]
  customers: Customer[]
  products: Product[]
  melhorEnvioConnected?: boolean
  shipment?: Shipment | null
  paymentMethods?: PaymentMethod[]
}) {
  const [lines, setLines] = useState<Line[]>(() => {
    if (items && items.length > 0) {
      return items.map((item, i) => ({ key: i, product_id: item.product_id, quantity: item.quantity }))
    }
    return [{ key: 0, product_id: '', quantity: 1 }]
  })
  function addLine() {
    setLines((ls) => {
      const nextKey = ls.length ? Math.max(...ls.map((l) => l.key)) + 1 : 0
      return [...ls, { key: nextKey, product_id: '', quantity: 1 }]
    })
  }

  function removeLine(key: number) {
    setLines((ls) => ls.filter((l) => l.key !== key))
  }

  function updateLine(key: number, patch: Partial<Line>) {
    setLines((ls) => ls.map((l) => (l.key === key ? { ...l, ...patch } : l)))
  }

  function priceOf(productId: string) {
    return products.find((p) => p.id === productId)?.price ?? 0
  }

  function stockOf(productId: string) {
    return products.find((p) => p.id === productId)?.stock_quantity ?? 0
  }

  const [deliveryMethod, setDeliveryMethod] = useState<DeliveryMethod>(order?.delivery_method ?? 'a_combinar')
  const [deliveryFee, setDeliveryFee] = useState<number | string>(order?.delivery_fee ? order.delivery_fee : '')
  const [motoStatus, setMotoStatus] = useState<'idle' | 'loading' | 'error'>('idle')
  const [motoError, setMotoError] = useState<string | null>(null)

  const [paymentMethodId, setPaymentMethodId] = useState(order?.payment_method_id ?? '')
  const [discountType, setDiscountType] = useState<'' | DiscountType>(order?.discount_type ?? '')
  const [discountValue, setDiscountValue] = useState<number | string>(
    order?.discount_value ? order.discount_value : ''
  )

  // Formas ativas + a forma já gravada no pedido (mesmo que tenha sido
  // desativada depois), para não sumir da tela ao editar um pedido antigo.
  const paymentOptions = paymentMethods.filter((m) => m.active || m.id === order?.payment_method_id)

  const feeNumber = Number(String(deliveryFee).replace(',', '.')) || 0
  const itemsTotal = lines.reduce((sum, l) => sum + priceOf(l.product_id) * (l.quantity || 0), 0)
  const { discount, total } = orderTotal({
    itemsSubtotal: itemsTotal,
    discountType: discountType || null,
    discountValue: Number(String(discountValue).replace(',', '.')) || 0,
    deliveryFee: feeNumber,
  })

  async function recalcMotoboy() {
    if (!order) return
    setMotoStatus('loading')
    setMotoError(null)
    try {
      const res = await fetch(`/api/pedidos/${order.id}/entrega/motoboy`, { method: 'POST' })
      const data = await res.json()
      if (!res.ok) {
        setMotoStatus('error')
        setMotoError(data.error ?? 'Falha ao cotar motoboy.')
        return
      }
      setDeliveryMethod('motoboy')
      setDeliveryFee(data.fee)
      setMotoStatus('idle')
    } catch {
      setMotoStatus('error')
      setMotoError('Falha ao cotar motoboy.')
    }
  }

  return (
    <form action={saveOrder} className="flex flex-col gap-3 max-w-2xl">
      {order && <input type="hidden" name="id" value={order.id} />}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Field label="Cliente">
          <select name="customer_id" defaultValue={order?.customer_id ?? ''} required className="input">
            <option value="" disabled>
              Selecione um cliente
            </option>
            {customers.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </Field>

        <Field label="Status">
          <select name="status" defaultValue={(order?.status ?? 'rascunho') as OrderStatus} className="input">
            <option value="rascunho">Rascunho</option>
            <option value="confirmado">Confirmado</option>
            <option value="cancelado">Cancelado</option>
          </select>
        </Field>
      </div>

      <section className="flex flex-col gap-3 card-tight">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-bold">Produtos</h2>
          <button type="button" onClick={addLine} className="text-xs font-semibold text-accent">
            + Adicionar produto
          </button>
        </div>

        <div className="flex flex-col gap-3">
          {lines.map((line) => (
            <div key={line.key} className="flex flex-col gap-2 border border-line rounded-lg p-3">
              <Field label="Produto">
                <select
                  name="product_id"
                  value={line.product_id}
                  onChange={(e) => updateLine(line.key, { product_id: e.target.value })}
                  required
                  className="input"
                >
                  <option value="" disabled>
                    Selecione um produto
                  </option>
                  {products.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} — {formatPrice(p.price)} — {p.stock_quantity} un.
                    </option>
                  ))}
                </select>
              </Field>
              {line.product_id && line.quantity > stockOf(line.product_id) && (
                <p className="text-xs text-amber-600 font-semibold">
                  Só há {stockOf(line.product_id)} un. em estoque — não será possível confirmar o pedido assim.
                </p>
              )}
              <div className="flex items-end gap-2">
                <div className="w-20 shrink-0">
                  <Field label="Qtd">
                    <input
                      name="quantity"
                      type="number"
                      min={1}
                      value={line.quantity}
                      onChange={(e) => updateLine(line.key, { quantity: Number(e.target.value) })}
                      required
                      className="input"
                    />
                  </Field>
                </div>
                <div className="flex-1 text-right text-sm font-semibold pb-2 tabular-nums truncate">
                  {formatPrice(priceOf(line.product_id) * (line.quantity || 0))}
                </div>
                <button
                  type="button"
                  onClick={() => removeLine(line.key)}
                  disabled={lines.length === 1}
                  className="text-xs font-semibold text-red-600 pb-2.5 shrink-0 disabled:opacity-30"
                >
                  Remover
                </button>
              </div>
            </div>
          ))}
        </div>

        <div className="flex flex-col gap-1 border-t border-line pt-3 text-sm">
          <div className="flex justify-between text-muted">
            <span>Itens</span>
            <span>{formatPrice(itemsTotal)}</span>
          </div>
          {discount > 0 && (
            <div className="flex justify-between text-muted">
              <span>Desconto{discountType === 'percent' ? ` (${Number(String(discountValue).replace(',', '.')) || 0}%)` : ''}</span>
              <span>- {formatPrice(discount)}</span>
            </div>
          )}
          {feeNumber > 0 && (
            <div className="flex justify-between text-muted">
              <span>Entrega ({DELIVERY_LABELS[deliveryMethod]})</span>
              <span>{formatPrice(feeNumber)}</span>
            </div>
          )}
          <div className="flex justify-between font-bold">
            <span>Total</span>
            <span>{formatPrice(total)}</span>
          </div>
        </div>
      </section>

      <section className="flex flex-col gap-3 card-tight">
        <h2 className="text-sm font-bold">Pagamento e desconto</h2>
        <Field label="Forma de pagamento">
          <select
            name="payment_method_id"
            value={paymentMethodId}
            onChange={(e) => setPaymentMethodId(e.target.value)}
            className="input"
          >
            <option value="">— Não informada —</option>
            {paymentOptions.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
                {!m.active ? ' (inativa)' : ''}
              </option>
            ))}
          </select>
        </Field>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Field label="Desconto">
            <select
              name="discount_type"
              value={discountType}
              onChange={(e) => setDiscountType(e.target.value as '' | DiscountType)}
              className="input"
            >
              <option value="">Sem desconto</option>
              <option value="percent">Porcentagem (%)</option>
              <option value="amount">Valor (R$)</option>
            </select>
          </Field>
          <Field label={discountType === 'percent' ? 'Percentual (%)' : 'Valor do desconto (R$)'}>
            <input
              name="discount_value"
              type="number"
              step="0.01"
              min="0"
              value={discountValue}
              onChange={(e) => setDiscountValue(e.target.value)}
              placeholder={discountType === 'percent' ? '0' : '0,00'}
              disabled={!discountType}
              className="input disabled:opacity-50"
            />
          </Field>
        </div>
        {paymentMethods.length === 0 && (
          <p className="text-xs text-muted">
            Nenhuma forma de pagamento cadastrada. Cadastre em{' '}
            <a href="/admin/formas-pagamento" className="text-accent underline">
              Formas de pagamento
            </a>
            .
          </p>
        )}
      </section>

      <section className="flex flex-col gap-3 card-tight">
        <h2 className="text-sm font-bold">Entrega</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Field label="Método">
            <select
              name="delivery_method"
              value={deliveryMethod}
              onChange={(e) => setDeliveryMethod(e.target.value as DeliveryMethod)}
              className="input"
            >
              <option value="a_combinar">A combinar</option>
              <option value="retirada">Retirar na loja</option>
              <option value="motoboy">Motoboy (Lalamove)</option>
              <option value="melhor_envio">Melhor Envio (transportadora)</option>
            </select>
          </Field>
          <Field label="Valor da entrega (R$)">
            <input
              name="delivery_fee"
              type="number"
              step="0.01"
              min="0"
              value={deliveryFee}
              onChange={(e) => setDeliveryFee(e.target.value)}
              placeholder="0,00"
              className="input"
            />
          </Field>
        </div>
        {order && deliveryMethod === 'motoboy' && (
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={recalcMotoboy}
              disabled={motoStatus === 'loading'}
              className="btn btn-sm btn-secondary disabled:opacity-50"
            >
              {motoStatus === 'loading' ? 'Cotando...' : 'Cotar motoboy (Lalamove)'}
            </button>
            <span className="text-xs text-muted">Usa o endereço cadastrado do cliente.</span>
          </div>
        )}
        {motoError && deliveryMethod === 'motoboy' && <p className="text-xs text-red-600">{motoError}</p>}
        {deliveryMethod === 'melhor_envio' &&
          (order ? (
            <div className="border-t border-line pt-3">
              <ShippingCard orderId={order.id} connected={melhorEnvioConnected} shipment={shipment} bare />
            </div>
          ) : (
            <p className="text-xs text-muted">
              Salve o pedido para liberar a cotação e a geração da etiqueta do Melhor Envio.
            </p>
          ))}
      </section>

      <Field label="Observações">
        <textarea name="notes" defaultValue={order?.notes ?? ''} className="input h-20" />
      </Field>

      <div className="flex flex-wrap gap-2 justify-end mt-2">
        <a href="/admin/pedidos" className="btn btn-secondary">
          Cancelar
        </a>
        <button type="submit" className="btn btn-primary">
          Salvar pedido
        </button>
      </div>
    </form>
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
