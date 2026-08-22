'use client'

import { useState } from 'react'
import type { ReactNode } from 'react'
import { submitPublicOrder } from '@/app/pedido/[slug]/actions'
import type { Category, Customer, Product } from '@/lib/types'

function formatPrice(value: number) {
  return `R$ ${Number(value).toFixed(2).replace('.', ',')}`
}

export default function PublicOrderForm({
  slug,
  categories,
  products,
  foundCustomer,
  typedDocument,
}: {
  slug: string
  categories: Category[]
  products: Product[]
  foundCustomer: Customer | null
  typedDocument: string | null
}) {
  const [quantities, setQuantities] = useState<Record<string, number>>({})

  const total = products.reduce((sum, p) => sum + (quantities[p.id] || 0) * Number(p.price), 0)
  const itemCount = Object.values(quantities).reduce((sum, q) => sum + (q > 0 ? q : 0), 0)

  const groups = categories
    .map((category) => ({ category, items: products.filter((p) => p.category_id === category.id) }))
    .filter((g) => g.items.length > 0)

  return (
    <form action={submitPublicOrder} className="flex flex-col gap-4">
      <input type="hidden" name="slug" value={slug} />

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

      <div className="flex justify-between items-center border-t border-line pt-3 text-sm font-bold">
        <span>
          {itemCount} {itemCount === 1 ? 'item' : 'itens'}
        </span>
        <span>Total: {formatPrice(total)}</span>
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
        disabled={itemCount === 0}
        className="bg-accent text-white rounded-lg px-4 py-2 text-sm font-bold disabled:opacity-40"
      >
        Enviar pedido
      </button>
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
