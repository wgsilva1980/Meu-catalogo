'use client'

import { useState } from 'react'
import type { ReactNode } from 'react'
import { saveOrder } from '@/app/admin/pedidos/actions'
import type { Customer, OrderStatus, Product, SalesOrder, SalesOrderItem } from '@/lib/types'

type Line = { key: number; product_id: string; quantity: number }

function formatPrice(value: number) {
  return `R$ ${Number(value).toFixed(2).replace('.', ',')}`
}

export default function OrderForm({
  order,
  items,
  customers,
  products,
}: {
  order?: SalesOrder
  items?: SalesOrderItem[]
  customers: Customer[]
  products: Product[]
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

  const total = lines.reduce((sum, l) => sum + priceOf(l.product_id) * (l.quantity || 0), 0)

  return (
    <form action={saveOrder} className="flex flex-col gap-3 max-w-2xl">
      {order && <input type="hidden" name="id" value={order.id} />}

      <div className="grid grid-cols-2 gap-3">
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

      <section className="flex flex-col gap-3 border border-line rounded-xl p-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-bold">Produtos</h2>
          <button type="button" onClick={addLine} className="text-xs font-semibold text-accent">
            + Adicionar produto
          </button>
        </div>

        <div className="flex flex-col gap-2">
          {lines.map((line) => (
            <div key={line.key} className="flex items-end gap-2">
              <div className="flex-1">
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
                        {p.name} — {formatPrice(p.price)}
                      </option>
                    ))}
                  </select>
                </Field>
              </div>
              <div className="w-20">
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
              <div className="w-24 text-right text-sm font-semibold pb-2 tabular-nums">
                {formatPrice(priceOf(line.product_id) * (line.quantity || 0))}
              </div>
              <button
                type="button"
                onClick={() => removeLine(line.key)}
                disabled={lines.length === 1}
                className="text-xs font-semibold text-red-600 pb-2.5 disabled:opacity-30"
              >
                Remover
              </button>
            </div>
          ))}
        </div>

        <div className="flex justify-end border-t border-line pt-3 text-sm font-bold">Total: {formatPrice(total)}</div>
      </section>

      <Field label="Observações">
        <textarea name="notes" defaultValue={order?.notes ?? ''} className="input h-20" />
      </Field>

      <div className="flex gap-2 justify-end mt-2">
        <a href="/admin/pedidos" className="border border-line rounded-lg px-4 py-2 text-sm font-semibold">
          Cancelar
        </a>
        <button type="submit" className="bg-accent text-white rounded-lg px-4 py-2 text-sm font-bold">
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
