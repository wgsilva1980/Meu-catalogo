'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { resolveActiveCompany } from '@/lib/company'
import type { StockMovementType } from '@/lib/types'

const MAX_QUANTITY = 1_000_000

function parseQuantity(raw: unknown): number {
  const n = Math.floor(Number(raw))
  if (!Number.isFinite(n) || n <= 0) return 0
  return Math.min(n, MAX_QUANTITY)
}

function parseCount(raw: unknown): number | null {
  const n = Math.floor(Number(raw))
  if (!Number.isFinite(n) || n < 0) return null
  return Math.min(n, MAX_QUANTITY)
}

// Traduz o erro cru vindo do Postgres/PostgREST para um código curto que a
// página de estoque sabe renderizar como banner.
function errorCode(message: string | undefined): string {
  const m = message ?? ''
  if (m.includes('ESTOQUE_INSUFICIENTE')) return 'insuficiente'
  if (m.includes('PRODUTO_NAO_ENCONTRADO')) return 'produto'
  return 'falha'
}

async function applyMovement(opts: {
  productId: string
  type: StockMovementType
  delta: number
  note: string | null
  allowNegative: boolean
}): Promise<{ ok: true } | { ok: false; code: string }> {
  const active = await resolveActiveCompany()
  if (!active.ok) return { ok: false, code: 'falha' }

  const supabase = await createClient()
  const { error } = await supabase.rpc('apply_stock_movement', {
    p_company_id: active.companyId,
    p_product_id: opts.productId,
    p_type: opts.type,
    p_delta: opts.delta,
    p_note: opts.note,
    p_order_id: null,
    p_allow_negative: opts.allowNegative,
  })

  if (error) {
    console.error('Falha ao aplicar movimento de estoque:', error)
    return { ok: false, code: errorCode(error.message) }
  }
  return { ok: true }
}

export async function registerEntry(formData: FormData) {
  const productId = formData.get('product_id') as string
  const quantity = parseQuantity(formData.get('quantity'))
  const note = ((formData.get('note') as string) || '').trim() || null
  if (!productId || !quantity) redirect(`/admin/estoque/${productId}?erro=quantidade`)

  const result = await applyMovement({ productId, type: 'entrada', delta: quantity, note, allowNegative: true })
  revalidatePath('/admin/estoque')
  revalidatePath(`/admin/estoque/${productId}`)
  redirect(`/admin/estoque/${productId}?${result.ok ? 'ok=entrada' : `erro=${result.code}`}`)
}

export async function registerExit(formData: FormData) {
  const productId = formData.get('product_id') as string
  const quantity = parseQuantity(formData.get('quantity'))
  const note = ((formData.get('note') as string) || '').trim() || null
  if (!productId || !quantity) redirect(`/admin/estoque/${productId}?erro=quantidade`)

  const result = await applyMovement({ productId, type: 'saida', delta: -quantity, note, allowNegative: false })
  revalidatePath('/admin/estoque')
  revalidatePath(`/admin/estoque/${productId}`)
  redirect(`/admin/estoque/${productId}?${result.ok ? 'ok=saida' : `erro=${result.code}`}`)
}

export async function registerAdjustment(formData: FormData) {
  const active = await resolveActiveCompany()
  if (!active.ok) return

  const productId = formData.get('product_id') as string
  const counted = parseCount(formData.get('counted'))
  const note = ((formData.get('note') as string) || '').trim() || null
  if (!productId || counted === null) redirect(`/admin/estoque/${productId}?erro=quantidade`)

  const supabase = await createClient()
  const { data: product } = await supabase
    .from('products')
    .select('stock_quantity')
    .eq('id', productId)
    .eq('company_id', active.companyId)
    .maybeSingle()
  if (!product) redirect(`/admin/estoque/${productId}?erro=produto`)

  const delta = counted - product.stock_quantity
  if (delta === 0) redirect(`/admin/estoque/${productId}?ok=ajuste`)

  const result = await applyMovement({ productId, type: 'ajuste', delta, note, allowNegative: true })
  revalidatePath('/admin/estoque')
  revalidatePath(`/admin/estoque/${productId}`)
  redirect(`/admin/estoque/${productId}?${result.ok ? 'ok=ajuste' : `erro=${result.code}`}`)
}

export async function updateThreshold(formData: FormData) {
  const active = await resolveActiveCompany()
  if (!active.ok) return

  const productId = formData.get('product_id') as string
  const raw = Math.floor(Number(formData.get('low_stock_threshold')))
  const threshold = Number.isFinite(raw) && raw > 0 ? Math.min(raw, MAX_QUANTITY) : 0

  const supabase = await createClient()
  await supabase
    .from('products')
    .update({ low_stock_threshold: threshold })
    .eq('id', productId)
    .eq('company_id', active.companyId)

  revalidatePath('/admin/estoque')
  revalidatePath(`/admin/estoque/${productId}`)
  redirect(`/admin/estoque/${productId}?ok=minimo`)
}
