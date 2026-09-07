// process.env.VERCEL_URL/VERCEL_PROJECT_PRODUCTION_URL são preenchidos
// automaticamente pela Vercel (preview e produção) — sem precisar cadastrar
// uma env var própria só pra isso. Usado pra resolver URLs absolutas em
// metadata (app/layout.tsx), robots.txt e sitemap.xml (achado P3 do
// "Raio-X do Catálogo II" — nenhum dos dois existia).
export function getSiteUrl() {
  return (
    process.env.NEXT_PUBLIC_SITE_URL ??
    (process.env.VERCEL_PROJECT_PRODUCTION_URL && `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`) ??
    (process.env.VERCEL_URL && `https://${process.env.VERCEL_URL}`) ??
    'http://localhost:3000'
  )
}
