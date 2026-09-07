// Esqueleto da tela mais visitada do painel — achado P3 do "Raio-X do
// Catálogo II". Sem isso, uma consulta lenta ao Supabase em conexão ruim
// virava tela branca em vez de dar algum sinal de que algo está
// carregando. `animate-pulse` já respeita prefers-reduced-motion (regra
// global em app/globals.css, Fase 5).
function Block({ className }: { className: string }) {
  return <div className={`bg-line/20 rounded-lg animate-pulse ${className}`} />
}

export default function AdminLoading() {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <Block className="h-7 w-40" />
        <Block className="h-4 w-64" />
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <Block key={i} className="h-20" />
        ))}
      </div>

      <div className="flex flex-col gap-2">
        <Block className="h-4 w-48" />
        <Block className="h-40" />
      </div>
    </div>
  )
}
