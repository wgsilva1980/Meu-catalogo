import type { MetadataRoute } from 'next'

// Ver "Raio-X do Catálogo", achado P2: nenhuma rota tinha manifest — sem
// isso o navegador não oferece "instalar" o painel/catálogo e um link
// salvo na tela inicial não tem ícone nem nome próprio.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Meu Catálogo',
    short_name: 'Catálogo',
    description: 'Catálogo de produtos e pedidos online.',
    start_url: '/login',
    display: 'standalone',
    background_color: '#F4F5F1',
    theme_color: '#BE4A1B',
    icons: [
      { src: '/icon', sizes: '32x32', type: 'image/png' },
      { src: '/apple-icon', sizes: '180x180', type: 'image/png' },
    ],
  }
}
