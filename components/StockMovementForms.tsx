'use client'

import { useState } from 'react'
import type { ReactNode } from 'react'
import { registerAdjustment, registerEntry, registerExit, updateThreshold } from '@/app/admin/estoque/actions'
import Card from '@/components/Card'
import Button from '@/components/Button'

type Tab = 'entrada' | 'saida' | 'ajuste'

const TABS: { value: Tab; label: string }[] = [
  { value: 'entrada', label: 'Entrada' },
  { value: 'saida', label: 'Baixa' },
  { value: 'ajuste', label: 'Ajuste' },
]

export default function StockMovementForms({
  productId,
  currentStock,
  lowStockThreshold,
}: {
  productId: string
  currentStock: number
  lowStockThreshold: number
}) {
  const [tab, setTab] = useState<Tab>('entrada')

  return (
    <Card as="section" tight className="flex flex-col gap-4">
      <div className="flex flex-wrap gap-2">
        {TABS.map((t) => (
          <button
            key={t.value}
            type="button"
            onClick={() => setTab(t.value)}
            className={`px-3 py-1.5 rounded-full text-xs font-semibold border ${
              tab === t.value ? 'bg-accent/10 text-accent border-transparent' : 'text-muted border-line'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'entrada' && (
        <form action={registerEntry} className="flex flex-col gap-3">
          <input type="hidden" name="product_id" value={productId} />
          <p className="text-xs text-muted">Recebimento de mercadoria. Soma ao saldo.</p>
          <div className="flex flex-wrap gap-3">
            <div className="w-28">
              <Field label="Quantidade">
                <input name="quantity" type="number" min="1" step="1" required className="input" autoFocus />
              </Field>
            </div>
            <div className="flex-1 min-w-[12rem]">
              <Field label="Observação">
                <input name="note" placeholder="nota fiscal, fornecedor..." className="input" />
              </Field>
            </div>
          </div>
          <Submit>Registrar entrada</Submit>
        </form>
      )}

      {tab === 'saida' && (
        <form action={registerExit} className="flex flex-col gap-3">
          <input type="hidden" name="product_id" value={productId} />
          <p className="text-xs text-muted">
            Baixa manual (perda, quebra, consumo interno). Subtrai do saldo — vendas são baixadas pelo pedido.
          </p>
          <div className="flex flex-wrap gap-3">
            <div className="w-28">
              <Field label="Quantidade">
                <input name="quantity" type="number" min="1" step="1" max={Math.max(currentStock, 1)} required className="input" />
              </Field>
            </div>
            <div className="flex-1 min-w-[12rem]">
              <Field label="Motivo">
                <input name="note" placeholder="quebra, vencimento..." className="input" />
              </Field>
            </div>
          </div>
          <Submit>Registrar baixa</Submit>
        </form>
      )}

      {tab === 'ajuste' && (
        <form action={registerAdjustment} className="flex flex-col gap-3">
          <input type="hidden" name="product_id" value={productId} />
          <p className="text-xs text-muted">
            Inventário: informe a quantidade contada. A diferença para o saldo atual ({currentStock}) é registrada como ajuste.
          </p>
          <div className="flex flex-wrap gap-3">
            <div className="w-28">
              <Field label="Saldo contado">
                <input name="counted" type="number" min="0" step="1" defaultValue={currentStock} required className="input" />
              </Field>
            </div>
            <div className="flex-1 min-w-[12rem]">
              <Field label="Observação">
                <input name="note" placeholder="contagem de inventário..." className="input" />
              </Field>
            </div>
          </div>
          <Submit>Aplicar ajuste</Submit>
        </form>
      )}

      <form action={updateThreshold} className="flex flex-wrap items-end gap-3 border-t border-line pt-3">
        <input type="hidden" name="product_id" value={productId} />
        <div className="w-40">
          <Field label="Estoque mínimo (alerta)">
            <input
              name="low_stock_threshold"
              type="number"
              min="0"
              step="1"
              defaultValue={lowStockThreshold}
              className="input"
            />
          </Field>
        </div>
        <Button type="submit" variant="secondary">
          Salvar mínimo
        </Button>
      </form>
    </Card>
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

function Submit({ children }: { children: ReactNode }) {
  return (
    <div>
      <Button type="submit">{children}</Button>
    </div>
  )
}
