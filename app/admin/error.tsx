'use client'

import { useEffect } from 'react'
import Button from '@/components/Button'
import Alert from '@/components/Alert'

// Achado P3 do "Raio-X do Catálogo II" — nenhuma rota tinha error.tsx; um
// erro não tratado (ex.: instabilidade momentânea do Supabase) derrubava a
// tela inteira sem chance de tentar de novo sem recarregar a página.
export default function AdminError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error)
  }, [error])

  return (
    <div className="flex flex-col items-center justify-center gap-4 py-16 text-center max-w-sm mx-auto">
      <Alert variant="danger" center>
        Não foi possível carregar esta página agora. Tente de novo em instantes.
      </Alert>
      <Button type="button" onClick={() => reset()}>
        Tentar de novo
      </Button>
    </div>
  )
}
