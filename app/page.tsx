import Button from '@/components/Button'
import Badge from '@/components/Badge'

// A splash era 100% texto desde a primeira auditoria ("nenhuma imagem,
// ilustração ou prévia do produto") — as três rodadas de correção sempre
// deixaram isso de fora por ser o item de menor prioridade da lista. Em
// vez de uma ilustração decorativa, é uma prévia literal da vitrine
// pública (a mesma composição de components/PublicOrderForm.tsx: card com
// foto, nome, preço e um badge de oferta) — respondendo "o que este
// produto faz" antes mesmo do visitante ler o parágrafo.
function VitrinePreview() {
  return (
    <div className="w-full max-w-[280px] rounded-xl border border-line bg-surface shadow-sm overflow-hidden">
      <div className="flex items-center gap-1.5 border-b border-line px-3 py-2">
        <span className="w-2 h-2 rounded-full bg-line" />
        <span className="w-2 h-2 rounded-full bg-line" />
        <span className="w-2 h-2 rounded-full bg-line" />
      </div>
      <div className="grid grid-cols-2 gap-2 p-3">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="relative flex flex-col overflow-hidden rounded-lg border border-line bg-surface">
            <div className="relative aspect-square bg-paper">
              {i === 0 && (
                <Badge variant="promo" size="sm" className="absolute top-1 left-1 px-1.5 py-0 text-[9px] shadow-sm">
                  Oferta
                </Badge>
              )}
            </div>
            <div className="flex flex-col gap-1 p-1.5">
              <div className="h-1.5 w-4/5 rounded-full bg-line/50" />
              <div className="h-1.5 w-1/2 rounded-full bg-accent/30" />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

export default function HomePage() {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center gap-5 text-center px-6">
      <VitrinePreview />
      <span className="text-xs uppercase tracking-widest text-accent font-bold">Catálogo & Pedidos</span>
      <h1 className="font-display text-display">Meu Catalogo</h1>
      <p className="text-muted max-w-sm text-sm leading-relaxed">
        Monte seu catálogo, receba pedidos e acompanhe pagamento e entrega — sem planilha.
      </p>
      <Button href="/login" className="px-5 py-3">
        Acessar painel
      </Button>
      <p className="text-xs text-muted mt-4">© {new Date().getFullYear()} Meu Catalogo</p>
    </main>
  )
}
