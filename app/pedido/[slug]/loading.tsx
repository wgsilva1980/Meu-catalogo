// Esqueleto da tela pública mais visitada (é onde a venda acontece) —
// achado P3 do "Raio-X do Catálogo II". `animate-pulse` já respeita
// prefers-reduced-motion (regra global em app/globals.css, Fase 5).
function Block({ className }: { className: string }) {
  return <div className={`bg-line/20 rounded-lg animate-pulse ${className}`} />
}

export default function PedidoLoading() {
  return (
    <>
      <header className="bg-surface border-b border-line">
        <div className="max-w-2xl mx-auto px-4 sm:px-6 py-3">
          <Block className="h-6 w-40" />
        </div>
      </header>
      <main className="min-h-screen flex flex-col items-center px-4 py-10 gap-8">
        <div className="w-full max-w-2xl card flex flex-col gap-4">
          <div className="flex flex-col items-center gap-2">
            <Block className="h-6 w-48" />
            <Block className="h-4 w-72" />
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mt-2">
            {Array.from({ length: 6 }).map((_, i) => (
              <Block key={i} className="aspect-square" />
            ))}
          </div>
        </div>
      </main>
    </>
  )
}
