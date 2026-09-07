import type { Metadata } from 'next'
import './globals.css'

// process.env.VERCEL_URL/VERCEL_PROJECT_PRODUCTION_URL são preenchidos
// automaticamente pela Vercel (preview e produção) — sem precisar cadastrar
// uma env var própria só pra isso. metadataBase é o que permite os campos
// relativos abaixo (e os de generateMetadata das páginas públicas) virarem
// URLs absolutas nas prévias de OpenGraph/Twitter.
const siteUrl =
  process.env.NEXT_PUBLIC_SITE_URL ??
  (process.env.VERCEL_PROJECT_PRODUCTION_URL && `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`) ??
  (process.env.VERCEL_URL && `https://${process.env.VERCEL_URL}`) ??
  'http://localhost:3000'

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: 'Meu Catalogo — Painel',
  description: 'Sistema interno de geração de catálogos em PDF',
  openGraph: {
    title: 'Meu Catalogo',
    description: 'Sistema interno de geração de catálogos em PDF',
    siteName: 'Meu Catalogo',
    locale: 'pt_BR',
    type: 'website',
  },
  twitter: {
    card: 'summary',
    title: 'Meu Catalogo',
    description: 'Sistema interno de geração de catálogos em PDF',
  },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  )
}
