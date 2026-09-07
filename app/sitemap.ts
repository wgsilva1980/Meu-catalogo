import type { MetadataRoute } from 'next'
import { createAdminClient } from '@/lib/supabase/admin'
import { getSiteUrl } from '@/lib/siteUrl'

// Sem isso, a lista de lojas ativas fica congelada no que existia no
// último deploy — uma loja nova só apareceria aqui depois do próximo
// build. Regenerar a cada hora é suficiente pra um sitemap.
export const revalidate = 3600

// Achado P3 do "Raio-X do Catálogo II" — nenhuma rota tinha sitemap. Uma
// lista estática só com "/" não ajudaria em nada (é a splash institucional,
// não o conteúdo que alguém procura); o que vale pra um catálogo
// multi-loja é listar o link público de cada loja ativa, pra mecanismo de
// busca conseguir achar o catálogo de cada uma.
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const siteUrl = getSiteUrl()
  const supabase = createAdminClient()
  const { data: companies } = await supabase.from('companies').select('slug').eq('active', true)

  const storeEntries: MetadataRoute.Sitemap = (companies ?? []).flatMap((c) => [
    { url: `${siteUrl}/pedido/${c.slug}`, changeFrequency: 'daily' as const, priority: 0.8 },
    { url: `${siteUrl}/cadastro/${c.slug}`, changeFrequency: 'monthly' as const, priority: 0.5 },
  ])

  return [{ url: siteUrl, changeFrequency: 'monthly', priority: 1 }, ...storeEntries]
}
