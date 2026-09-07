// Fase 1 do plano de redesign ("Raio-X do Catálogo", seção 11) — antes
// disso a única fonte própria do produto era Georgia, só nos títulos de
// 18–24px; o resto usava a pilha padrão do sistema operacional. Fraunces
// (display, com contraste alto de traço) + Source Sans 3 (texto, neutra e
// legível em telas pequenas) substituem as duas.
//
// next/font em vez de um <link> pro Google Fonts: os arquivos ficam
// self-hosted (sem request pro Google em cada visita) e o Next já cuida do
// `font-display: swap` e do fallback de métrica pra não pular layout.
import { Fraunces, Source_Sans_3 } from 'next/font/google'

export const fraunces = Fraunces({
  subsets: ['latin'],
  weight: 'variable',
  variable: '--font-display',
  display: 'swap',
})

export const sourceSans3 = Source_Sans_3({
  subsets: ['latin'],
  weight: 'variable',
  variable: '--font-body',
  display: 'swap',
})
