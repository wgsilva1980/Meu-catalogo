'use client'

import { useEffect, useState, type ReactNode } from 'react'
import AdminSidebar from '@/components/AdminSidebar'

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
// claro por padrão.
//
// Antes disso o estado era repassado como render-prop (`children` era uma
// função `({dark, toggleDark}) => ReactNode`, chamada aqui dentro) — parecia
// uma forma simples de compartilhar `dark`/`toggleDark` com a sidebar sem a
// complexidade de um Provider de Context. Só que app/admin/layout.tsx (que
// passa `children`) é Server Component, e Server Component não pode passar
// uma função como prop pra um Client Component — só Server Actions (com
// "use server") cruzam essa fronteira. Isso derrubava a renderização inteira
// com "Functions cannot be passed directly to Client Components" (visível
// só como um digest sem stack trace em produção). A sidebar mudou de "quem
// recebe children como função" pra "quem este componente já renderiza
// direto" — `children` volta a ser um ReactNode normal, sempre serializável.
export default function AdminThemeShell({
  email,
  companyName,
  children,
}: {
  email: string
  companyName: string
  children: ReactNode
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
      <AdminSidebar email={email} companyName={companyName} dark={dark} onToggleDark={toggleDark} />
      {children}
    </div>
  )
}
