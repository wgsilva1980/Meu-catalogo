import type { Category, Company, Product } from '@/lib/types'

type CategoryWithProducts = Category & { products: Product[] }

function formatPrice(value: number) {
  return `R$ ${Number(value).toFixed(2).replace('.', ',')}`
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
        <h1 class="brand">${company.name}</h1>
        <div class="cover-title">
          <div class="title">Catálogo</div>
          <div class="edition">Edição ${edition}</div>
        </div>
      </div>
      <div class="cover-contact">
        ${company.phone ? `<div><strong>Contato</strong>${company.phone}</div>` : ''}
        ${company.instagram ? `<div><strong>Instagram</strong>${company.instagram}</div>` : ''}
        ${company.website ? `<div><strong>Site</strong>${company.website}</div>` : ''}
      </div>
    </section>`

  const tocPage = `
    <section class="page toc">
      <div class="toc-eyebrow">Índice</div>
      <h2 class="toc-title">Sumário</h2>
      <div class="toc-list">
        ${categories
          .map(
            (c, i) => `
          <div class="toc-row">
            <span class="num">${String(i + 1).padStart(2, '0')}</span>
            <span class="name">${c.name}</span>
            <span class="leader"></span>
          </div>`
          )
          .join('')}
      </div>
    </section>`

  const categoryPages = categories
    .map(
      (c, i) => `
    <section class="page catpage">
      <div class="cat-header">
        <div>
          <div class="cat-eyebrow">${String(i + 1).padStart(2, '0')} · Categoria</div>
          <h2 class="cat-name">${c.name}</h2>
        </div>
        <div class="cat-count">${c.products.length} ${c.products.length === 1 ? 'item' : 'itens'}</div>
      </div>
      <div class="cat-products">
        ${c.products
          .map(
            (p) => `
          <div class="prod-row">
            <div class="prod-img">${p.image_url ? `<img src="${p.image_url}" />` : ''}</div>
            <div class="prod-main">
              <div class="prod-name">${p.name}</div>
              <div class="prod-brand">${p.brand}</div>
              <div class="prod-desc">${p.short_description}</div>
              ${p.promo_note ? `<span class="prod-promo">${p.promo_note}</span>` : ''}
            </div>
            <div class="prod-price">${formatPrice(p.price)}</div>
          </div>`
          )
          .join('')}
      </div>
      <div class="catpage-footer"><span>${company.name}${company.phone ? ' · ' + company.phone : ''}</span></div>
    </section>`
    )
    .join('')

  return `<!doctype html>
<html>
<head>
<meta charset="utf-8" />
<style>${catalogCss}</style>
</head>
<body>${coverPage}${tocPage}${categoryPages}</body>
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
  .brand { font-family: Georgia, serif; font-size: 40px; margin: 0; }
  .sub { font-family: Georgia, serif; font-style: italic; color: #5B6472; font-size: 16px; margin: 6px 0 0; }
  .cover-title { margin-top: auto; }
  .title { font-size: 14px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; }
  .edition { color: #5B6472; font-size: 12px; }
  .cover-contact { border-top: 1px solid #E4E1D9; padding: 12mm 18mm; display: flex; justify-content: space-between; font-size: 10px; color: #5B6472; }
  .cover-contact strong { display: block; color: #12182A; font-size: 10px; margin-bottom: 2px; }

  .toc { padding: 24mm 18mm; }
  .toc-eyebrow { font-size: 11px; color: #FF5A36; letter-spacing: 0.1em; text-transform: uppercase; font-weight: 700; }
  .toc-title { font-family: Georgia, serif; font-size: 26px; margin: 4px 0 20px; border-bottom: 2px solid #12182A; padding-bottom: 10px; }
  .toc-row { display: flex; align-items: flex-end; gap: 8px; padding: 10px 0; border-bottom: 1px solid #E4E1D9; }
  .toc-row .num { font-size: 12px; color: #5B6472; width: 20px; }
  .toc-row .name { font-size: 14px; font-weight: 700; white-space: nowrap; }
  .toc-row .leader { flex: 1; border-bottom: 1px dotted #E4E1D9; margin-bottom: 4px; }

  .catpage { padding: 20mm 18mm; }
  .cat-header { display: flex; align-items: baseline; justify-content: space-between; border-bottom: 2px solid #12182A; padding-bottom: 10px; }
  .cat-eyebrow { font-size: 11px; color: #FF5A36; letter-spacing: 0.1em; text-transform: uppercase; font-weight: 700; }
  .cat-name { font-family: Georgia, serif; font-size: 24px; margin: 2px 0 0; }
  .cat-count { font-size: 11px; color: #5B6472; }
  .prod-row { display: flex; gap: 12px; padding: 14px 0; border-bottom: 1px solid #E4E1D9; }
  .prod-img { width: 22mm; height: 22mm; border-radius: 4px; background: #F4F5F1; border: 1px solid #E4E1D9; flex-shrink: 0; overflow: hidden; }
  .prod-img img { width: 100%; height: 100%; object-fit: cover; }
  .prod-main { flex: 1; }
  .prod-name { font-size: 14px; font-weight: 700; }
  .prod-brand { font-size: 10px; color: #5B6472; text-transform: uppercase; letter-spacing: 0.04em; margin-top: 1px; }
  .prod-desc { font-size: 11px; color: #5B6472; margin-top: 4px; line-height: 1.4; }
  .prod-promo { display: inline-block; margin-top: 5px; font-size: 10px; font-weight: 700; color: #C97A17; background: rgba(201,122,23,0.12); padding: 2px 7px; border-radius: 5px; }
  .prod-price { font-size: 15px; font-weight: 700; white-space: nowrap; }
  .catpage-footer { margin-top: auto; border-top: 1px solid #E4E1D9; padding-top: 8px; font-size: 9px; color: #5B6472; }
`
