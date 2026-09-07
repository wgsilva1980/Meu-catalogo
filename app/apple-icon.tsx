import { ImageResponse } from 'next/og'

// Mesmo monograma do favicon (app/icon.tsx), em tamanho maior — usado pelo
// iOS/Android quando alguém adiciona o catálogo à tela inicial.
export const size = { width: 180, height: 180 }
export const contentType = 'image/png'

export default function AppleIcon() {
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
          fontSize: 110,
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
