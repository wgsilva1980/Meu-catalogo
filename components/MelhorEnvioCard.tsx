import { disconnectMelhorEnvio } from '@/app/admin/configuracoes/melhor-envio/actions'
import Card from '@/components/Card'
import Button from '@/components/Button'
import Alert from '@/components/Alert'
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
    <Card as="section" tight className="flex flex-col gap-3">
      <div>
        <h2 className="text-sm font-bold">Melhor Envio</h2>
        <p className="text-xs text-muted">Conecte para calcular frete e gerar etiquetas direto dos pedidos.</p>
      </div>

      {error && (
        <Alert variant="danger" size="sm">
          {error}
        </Alert>
      )}
      {justConnected && !error && (
        <Alert variant="success" size="sm">
          Conta conectada com sucesso!
        </Alert>
      )}

      {account ? (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-sm">
            <span className="w-2 h-2 rounded-full bg-success" />
            <span className="font-semibold">Conectado</span>
            <span className="text-xs text-muted">
              ({account.environment === 'sandbox' ? 'ambiente de testes' : 'produção'} · desde{' '}
              {new Date(account.connected_at).toLocaleDateString('pt-BR')})
            </span>
          </div>
          <form action={disconnectMelhorEnvio}>
            <Button type="submit" variant="danger" size="sm">
              Desconectar
            </Button>
          </form>
        </div>
      ) : (
        <Button href="/admin/configuracoes/melhor-envio/connect" className="w-fit">
          Conectar Melhor Envio
        </Button>
      )}
    </Card>
  )
}
