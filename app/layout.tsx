import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Meu Catalogo — Painel',
  description: 'Sistema interno de geração de catálogos em PDF',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  )
}
