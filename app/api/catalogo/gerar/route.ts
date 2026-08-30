import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { resolveActiveCompany } from '@/lib/company'
import { buildCatalogHtml } from '@/lib/pdf/template'
import { launchBrowser } from '@/lib/pdf/browser'
import type { CatalogScope, Company } from '@/lib/types'

export const runtime = 'nodejs'
export const maxDuration = 60

export async function POST(request: Request) {
  const active = await resolveActiveCompany()
  if (!active.ok) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  const { companyId, userId } = active

  const supabase = await createClient()

  let body: { scope: CatalogScope }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Corpo da requisição inválido.' }, { status: 400 })
  }
  const scope: CatalogScope = body.scope

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

  let browser
  try {
    browser = await launchBrowser()
    const page = await browser.newPage()
    await page.setContent(html, { waitUntil: 'load' })
    const pdfBuffer = await page.pdf({ format: 'A4', printBackground: true })
    await browser.close()
    browser = undefined

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
    if (browser) await browser.close().catch(() => {})
    console.error('[catalogo/gerar]', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Erro ao gerar o PDF.' },
      { status: 500 }
    )
  }
}
