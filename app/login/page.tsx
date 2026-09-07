'use client'

import { useState, type FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)
    const supabase = createClient()
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    setLoading(false)
    if (error) {
      setError('E-mail ou senha inválidos.')
      return
    }
    router.push('/admin')
    router.refresh()
  }

  return (
    <main className="min-h-screen flex items-center justify-center px-6">
      <form onSubmit={handleSubmit} className="w-full max-w-xs card flex flex-col gap-3">
        <span className="font-display text-lg">Meu Catalogo</span>
        <h1 className="text-sm font-bold text-muted -mt-2 mb-1">Entrar no painel</h1>

        <label className="text-xs font-semibold text-muted flex flex-col gap-1">
          E-mail
          <input
            className="input"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </label>

        <label className="text-xs font-semibold text-muted flex flex-col gap-1">
          Senha
          <input
            className="input"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </label>

        {error && <p className="text-xs text-red-600">{error}</p>}

        <button disabled={loading} className="btn btn-primary mt-1 disabled:opacity-50">
          {loading ? 'Entrando...' : 'Entrar'}
        </button>

        <p className="text-xs text-muted text-center mt-1">
          Acesso restrito à equipe. Contas criadas pelo administrador.
        </p>
      </form>
    </main>
  )
}
