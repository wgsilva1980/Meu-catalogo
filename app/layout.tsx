import type { Metadata } from 'next'
import { fraunces, sourceSans3 } from '@/lib/fonts'
import { getSiteUrl } from '@/lib/siteUrl'
import './globals.css'

// metadataBase é o que permite os campos relativos abaixo (e os de
// generateMetadata das páginas públicas) virarem URLs absolutas nas
// prévias de OpenGraph/Twitter.
export const metadata: Metadata = {
  metadataBase: new URL(getSiteUrl()),
  title: 'Meu Catalogo — Painel',
  description: 'Monte seu catálogo, receba pedidos e acompanhe pagamento e entrega — sem planilha.',
  openGraph: {
    title: 'Meu Catalogo',
    description: 'Monte seu catálogo, receba pedidos e acompanhe pagamento e entrega — sem planilha.',
    siteName: 'Meu Catalogo',
    locale: 'pt_BR',
    type: 'website',
  },
  twitter: {
    card: 'summary',
    title: 'Meu Catalogo',
    description: 'Monte seu catálogo, receba pedidos e acompanhe pagamento e entrega — sem planilha.',
  },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" className={`${fraunces.variable} ${sourceSans3.variable}`}>
      <body>{children}</body>
    </html>
  )
}
