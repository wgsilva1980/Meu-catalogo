import { ImageResponse } from 'next/og'

// Favicon gerado em código (sem asset em /public) — usa o mesmo tom de
// accent do Tailwind config (já ajustado pra WCAG AA, ver tailwind.config.ts)
// como monograma da marca. Ver "Raio-X do Catálogo", achado P2: nenhuma
// rota tinha favicon, então compartilhar o link do catálogo não mostrava
// identidade nenhuma.
export const size = { width: 32, height: 32 }
export const contentType = 'image/png'

export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#BE4A1B',
          color: '#fff',
          fontSize: 20,
          fontWeight: 700,
          fontFamily: 'Georgia, serif',
        }}
      >
        M
      </div>
    ),
    { ...size }
  )
}
