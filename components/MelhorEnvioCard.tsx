import { disconnectMelhorEnvio } from '@/app/admin/configuracoes/melhor-envio/actions'
import type { MelhorEnvioAccount } from '@/lib/types'

export default function MelhorEnvioCard({
  account,
  error,
  justConnected,
}: {
  account: MelhorEnvioAccount | null
  error?: string
  justConnected?: boolean
}) {
  return (
    <section className="flex flex-col gap-3 card-tight">
      <div>
        <h2 className="text-sm font-bold">Melhor Envio</h2>
        <p className="text-xs text-muted">Conecte para calcular frete e gerar etiquetas direto dos pedidos.</p>
      </div>

      {error && <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg p-3">{error}</p>}
      {justConnected && !error && (
        <p className="text-xs text-green-700 bg-green-50 border border-green-200 rounded-lg p-3">Conta conectada com sucesso!</p>
      )}

      {account ? (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-sm">
            <span className="w-2 h-2 rounded-full bg-green-600" />
            <span className="font-semibold">Conectado</span>
            <span className="text-xs text-muted">
              ({account.environment === 'sandbox' ? 'ambiente de testes' : 'produção'} · desde{' '}
              {new Date(account.connected_at).toLocaleDateString('pt-BR')})
            </span>
          </div>
          <form action={disconnectMelhorEnvio}>
            <button type="submit" className="btn btn-sm btn-danger">
              Desconectar
            </button>
          </form>
        </div>
      ) : (
        <a
          href="/admin/configuracoes/melhor-envio/connect"
          className="btn btn-primary w-fit"
        >
          Conectar Melhor Envio
        </a>
      )}
    </section>
  )
}
