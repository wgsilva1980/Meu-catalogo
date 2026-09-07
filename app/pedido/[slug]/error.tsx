'use client'

import { useEffect } from 'react'
import Button from '@/components/Button'
import Alert from '@/components/Alert'

// Achado P3 do "Raio-X do Catálogo II" — é a tela mais visitada do fluxo
// público (onde a venda acontece) e não tinha nenhum error.tsx: um erro não
// tratado derrubava tudo sem chance de tentar de novo sem recarregar.
export default function PedidoError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error)
  }, [error])

  return (
    <main className="min-h-screen flex items-center justify-center px-6">
      <div className="w-full max-w-sm card flex flex-col items-center gap-4 text-center">
        <Alert variant="danger" center>
          Não foi possível carregar o catálogo agora. Tente de novo em instantes.
        </Alert>
        <Button type="button" onClick={() => reset()}>
          Tentar de novo
        </Button>
      </div>
    </main>
  )
}
