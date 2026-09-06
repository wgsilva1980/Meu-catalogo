import type { Category, Company, Product } from '@/lib/types'
import { formatPrice } from '@/lib/format'

type CategoryWithProducts = Category & { products: Product[] }

// O HTML é renderizado por um navegador headless para gerar o PDF, então todo
// texto dinâmico precisa ser escapado antes de entrar no markup.
function esc(value: unknown) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

// Só deixa passar URLs http(s) para dentro de atributos src=, bloqueando
// esquemas como javascript: / data: em imagens vindas do cadastro.
function safeUrl(value: unknown) {
  const raw = String(value ?? '').trim()
  return /^https?:\/\//i.test(raw) ? esc(raw) : ''
}

// Estimativas em mm usadas para decidir quantos itens cabem em uma página
// (não há medição real do DOM neste ponto, então os valores são conservadores).
const PAGE_CONTENT_BUDGET_MM = 225
const CATEGORY_HEADER_MM = 22
const PRODUCT_ROW_MM = 24

type CategorySegment = {
  category: CategoryWithProducts
  products: Product[]
  isContinuation: boolean
}

// Divide as categorias em páginas, permitindo várias por página e, quando uma
// categoria tem produtos demais para caber, continuando-a na página seguinte
// em vez de deixar itens transbordando (e sendo cortados) no fim da página.
function packProductsIntoPages(categories: CategoryWithProducts[]) {
  const pages: CategorySegment[][] = []
  let current: CategorySegment[] = []
  let currentHeight = 0

  const flush = () => {
    if (current.length > 0) {
      pages.push(current)
      current = []
      currentHeight = 0
    }
  }

  for (const category of categories) {
    let remaining = category.products
    let isFirstSegment = true

    while (remaining.length > 0) {
      let available = PAGE_CONTENT_BUDGET_MM - currentHeight
      let capacity = Math.floor((available - CATEGORY_HEADER_MM) / PRODUCT_ROW_MM)

      if (capacity <= 0) {
        flush()
        available = PAGE_CONTENT_BUDGET_MM
        capacity = Math.floor((available - CATEGORY_HEADER_MM) / PRODUCT_ROW_MM)
      }
      capacity = Math.max(capacity, 1)

      const take = Math.min(capacity, remaining.length)
      current.push({ category, products: remaining.slice(0, take), isContinuation: !isFirstSegment })
      currentHeight += CATEGORY_HEADER_MM + take * PRODUCT_ROW_MM
      remaining = remaining.slice(take)
      isFirstSegment = false

      if (remaining.length > 0) flush()
    }
  }
  flush()

  return pages
}

export function buildCatalogHtml({
  company,
  categories,
}: {
  company: Company
  categories: CategoryWithProducts[]
}) {
  const edition = new Date().toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })

  const coverPage = `
    <section class="page cover">
      <div class="cover-band"><span class="eyebrow">Catálogo de Produtos</span></div>
      <div class="cover-body">
        ${company.logo_url ? `<img class="cover-logo" src="${safeUrl(company.logo_url)}" alt="${esc(company.name)}" />` : ''}
        <h1 class="brand">${esc(company.name)}</h1>
        <div class="cover-title">
          <div class="title">Catálogo</div>
          <div class="edition">Edição ${esc(edition)}</div>
        </div>
      </div>
      <div class="cover-contact">
        ${company.phone ? `<div><strong>Contato</strong>${esc(company.phone)}</div>` : ''}
        ${company.instagram ? `<div><strong>Instagram</strong>${esc(company.instagram)}</div>` : ''}
        ${company.website ? `<div><strong>Site</strong>${esc(company.website)}</div>` : ''}
      </div>
    </section>`

  const pages = packProductsIntoPages(categories)
  const categoryNumber = new Map(categories.map((c, i) => [c.id, i + 1]))

  const categoryPages = pages
    .map((pageSegments) => {
      const blocks = pageSegments
        .map((segment) => {
          const { category: c, products, isContinuation } = segment
          const num = String(categoryNumber.get(c.id)).padStart(2, '0')
          return `
      <div class="cat-block">
        <div class="cat-header">
          <div>
            <div class="cat-eyebrow">${esc(num)} · Categoria${isContinuation ? ' (continuação)' : ''}</div>
            <h2 class="cat-name">${esc(c.name)}</h2>
          </div>
          <div class="cat-count">${c.products.length} ${c.products.length === 1 ? 'item' : 'itens'}</div>
        </div>
        <div class="cat-products">
          ${products
            .map(
              (p) => `
            <div class="prod-row">
              <div class="prod-img">${p.image_url ? `<img src="${safeUrl(p.image_url)}" />` : ''}</div>
              <div class="prod-main">
                <div class="prod-name">${esc(p.name)}</div>
                <div class="prod-brand">${esc(p.brand)}</div>
                <div class="prod-desc">${esc(p.short_description)}</div>
                ${p.promo_note ? `<span class="prod-promo">${esc(p.promo_note)}</span>` : ''}
              </div>
              <div class="prod-price">${formatPrice(p.price)}</div>
            </div>`
            )
            .join('')}
        </div>
      </div>`
        })
        .join('')

      return `
    <section class="page catpage">
      <div class="catpage-body">${blocks}</div>
      <div class="catpage-footer">
        ${company.logo_url ? `<img class="footer-logo" src="${safeUrl(company.logo_url)}" alt="" />` : ''}
        <span>${esc(company.name)}${company.phone ? ' · ' + esc(company.phone) : ''}</span>
      </div>
    </section>`
    })
    .join('')

  return `<!doctype html>
<html>
<head>
<meta charset="utf-8" />
<style>${catalogCss}</style>
</head>
<body>${coverPage}${categoryPages}</body>
</html>`
}

const catalogCss = `
  * { box-sizing: border-box; }
  body { margin: 0; font-family: -apple-system, Helvetica, Arial, sans-serif; color: #12182A; }
  .page { width: 210mm; height: 297mm; page-break-after: always; position: relative; display: flex; flex-direction: column; }
  .cover { padding: 0; }
  .cover-band { height: 30%; background: linear-gradient(155deg, #12182A 0%, #2A2233 60%, #FF5A36 130%); display: flex; align-items: flex-end; padding: 20mm 18mm; }
  .eyebrow { color: rgba(255,255,255,0.75); font-size: 11px; letter-spacing: 0.14em; text-transform: uppercase; }
  .cover-body { padding: 18mm; flex: 1; display: flex; flex-direction: column; }
  .cover-logo { max-height: 26mm; max-width: 70mm; object-fit: contain; margin-bottom: 8mm; }
  .brand { font-family: Georgia, serif; font-size: 40px; margin: 0; }
  .sub { font-family: Georgia, serif; font-style: italic; color: #5B6472; font-size: 16px; margin: 6px 0 0; }
  .cover-title { margin-top: auto; }
  .title { font-size: 14px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; }
  .edition { color: #5B6472; font-size: 12px; }
  .cover-contact { border-top: 1px solid #E4E1D9; padding: 12mm 18mm; display: flex; justify-content: space-between; font-size: 10px; color: #5B6472; }
  .cover-contact strong { display: block; color: #12182A; font-size: 10px; margin-bottom: 2px; }

  .catpage { padding: 16mm 16mm; }
  .catpage-body { flex: 1; display: flex; flex-direction: column; gap: 14px; }
  .cat-header { display: flex; align-items: baseline; justify-content: space-between; border-bottom: 2px solid #12182A; padding-bottom: 8px; }
  .cat-eyebrow { font-size: 11px; color: #FF5A36; letter-spacing: 0.1em; text-transform: uppercase; font-weight: 700; }
  .cat-name { font-family: Georgia, serif; font-size: 22px; margin: 2px 0 0; }
  .cat-count { font-size: 11px; color: #5B6472; }
  .prod-row { display: flex; gap: 10px; padding: 8px 0; border-bottom: 1px solid #E4E1D9; }
  .prod-img { width: 18mm; height: 18mm; border-radius: 4px; background: #F4F5F1; border: 1px solid #E4E1D9; flex-shrink: 0; overflow: hidden; }
  .prod-img img { width: 100%; height: 100%; object-fit: cover; }
  .prod-main { flex: 1; }
  .prod-name { font-size: 13px; font-weight: 700; }
  .prod-brand { font-size: 9px; color: #5B6472; text-transform: uppercase; letter-spacing: 0.04em; margin-top: 1px; }
  .prod-desc { font-size: 10.5px; color: #5B6472; margin-top: 3px; line-height: 1.35; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
  .prod-promo { display: inline-block; margin-top: 4px; font-size: 9px; font-weight: 700; color: #C97A17; background: rgba(201,122,23,0.12); padding: 2px 7px; border-radius: 5px; }
  .prod-price { font-size: 14px; font-weight: 700; white-space: nowrap; }
  .catpage-footer { margin-top: auto; border-top: 1px solid #E4E1D9; padding-top: 8px; font-size: 9px; color: #5B6472; display: flex; align-items: center; gap: 6px; }
  .footer-logo { height: 10mm; width: auto; object-fit: contain; }
`
