import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { resolveActiveCompany } from '@/lib/company'
import { buildCatalogHtml } from '@/lib/pdf/template'
import { renderHtmlToPdf } from '@/lib/pdf/browser'
import type { CatalogScope, Company } from '@/lib/types'

export const runtime = 'nodejs'
export const maxDuration = 60

function parseScope(raw: unknown): CatalogScope | null {
  if (!raw || typeof raw !== 'object') return null
  const type = (raw as { type?: unknown }).type
  if (type === 'all') return { type: 'all' }
  if (type === 'selection') {
    const ids = (raw as { categoryIds?: unknown }).categoryIds
    if (!Array.isArray(ids) || ids.some((id) => typeof id !== 'string')) return null
    return { type: 'selection', categoryIds: (ids as string[]).slice(0, 200) }
  }
  return null
}

export async function POST(request: Request) {
  const active = await resolveActiveCompany()
  if (!active.ok) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  const { companyId, userId } = active

  const supabase = await createClient()

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Corpo da requisição inválido.' }, { status: 400 })
  }

  const scope = parseScope((body as { scope?: unknown } | null)?.scope)
  if (!scope) {
    return NextResponse.json({ error: 'Escopo inválido.' }, { status: 400 })
  }

  const { data: companyRow } = await supabase.from('companies').select('*').eq('id', companyId).single()
  const company: Company = companyRow ?? {
    id: companyId,
    name: 'Minha loja',
    slug: companyId,
    logo_url: null,
    phone: null,
    email: null,
    instagram: null,
    website: null,
    active: true,
    created_at: new Date().toISOString(),
  }

  let categoriesQuery = supabase.from('categories').select('*').eq('company_id', companyId).order('sort_order')
  if (scope.type === 'selection') categoriesQuery = categoriesQuery.in('id', scope.categoryIds)
  const { data: categories } = await categoriesQuery

  const categoryIds = (categories ?? []).map((c) => c.id)
  const { data: products } = categoryIds.length
    ? await supabase
        .from('products')
        .select('*')
        .eq('company_id', companyId)
        .eq('available', true)
        .in('category_id', categoryIds)
        .order('name')
    : { data: [] }

  const categoriesWithProducts = (categories ?? [])
    .map((c) => ({ ...c, products: (products ?? []).filter((p) => p.category_id === c.id) }))
    .filter((c) => c.products.length > 0)

  if (categoriesWithProducts.length === 0) {
    return NextResponse.json({ error: 'Nenhum produto disponível para o escopo selecionado.' }, { status: 400 })
  }

  const html = buildCatalogHtml({ company, categories: categoriesWithProducts })

  try {
    const pdfBuffer = await renderHtmlToPdf(html)

    const admin = createAdminClient()
    const path = `${companyId}/catalogo-${Date.now()}.pdf`
    const { error: uploadError } = await admin.storage.from('catalogos').upload(path, pdfBuffer, {
      contentType: 'application/pdf',
    })
    if (uploadError) {
      return NextResponse.json({ error: 'Falha ao salvar o PDF gerado.' }, { status: 500 })
    }

    const { data: signed } = await admin.storage.from('catalogos').createSignedUrl(path, 60 * 60 * 24 * 7)

    await supabase.from('generated_catalogs').insert({
      scope,
      pdf_path: path,
      created_by: userId,
      company_id: companyId,
    })

    return NextResponse.json({ url: signed?.signedUrl })
  } catch (err) {
    console.error('[catalogo/gerar]', err)
    return NextResponse.json({ error: 'Erro ao gerar o PDF.' }, { status: 500 })
  }
}
