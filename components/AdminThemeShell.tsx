'use client'

import { useEffect, useState, type ReactNode } from 'react'

const STORAGE_KEY = 'admin-theme'

// Dono do estado claro/escuro do painel do lojista — Fase 5 ("Polish") do
// plano de redesign. Escopo deliberado: só a área logada de /admin, nunca
// as telas públicas (cadastro/pedido/acompanhamento) nem o painel de
// super-admin em /master. A classe `.dark` só existe dentro deste wrapper,
// então os tokens de cor (tailwind.config.ts + app/globals.css) só trocam
// de valor aqui dentro — nenhuma outra tela do produto é afetada.
//
// Preferência salva em localStorage (por navegador, não por conta) — dá
// pra abrir sem JS/local storage disponível sem quebrar nada, só cai no
// claro por padrão. Render-props em vez de Context porque só a sidebar
// (o botão) e este wrapper (a classe) precisam do estado — não vale a
// complexidade de um Provider pra dois consumidores.
export default function AdminThemeShell({
  children,
}: {
  children: (props: { dark: boolean; toggleDark: () => void }) => ReactNode
}) {
  const [dark, setDark] = useState(false)

  useEffect(() => {
    try {
      setDark(localStorage.getItem(STORAGE_KEY) === 'dark')
    } catch {
      // localStorage indisponível (modo privado, etc.) — segue no claro.
    }
  }, [])

  function toggleDark() {
    setDark((prev) => {
      const next = !prev
      try {
        localStorage.setItem(STORAGE_KEY, next ? 'dark' : 'light')
      } catch {
        // Sem storage, a escolha só dura a sessão da aba atual.
      }
      return next
    })
  }

  return (
    <div className={`min-h-screen flex flex-col md:flex-row bg-paper ${dark ? 'dark' : ''}`}>
      {children({ dark, toggleDark })}
    </div>
  )
}
