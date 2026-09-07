import type { MetadataRoute } from 'next'
import { getSiteUrl } from '@/lib/siteUrl'

// Achado P3 do "Raio-X do Catálogo II" — nenhuma rota tinha robots.txt.
// /admin e /master exigem login (um crawler nunca passaria disso mesmo),
// mas bloquear explicitamente evita que a URL de login/painel apareça
// indexada sem conteúdo nenhum atrás dela.
export default function robots(): MetadataRoute.Robots {
  const siteUrl = getSiteUrl()
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: ['/admin', '/master', '/login', '/api', '/acompanhar'],
    },
    sitemap: `${siteUrl}/sitemap.xml`,
  }
}
