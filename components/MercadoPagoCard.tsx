import { disconnectMercadoPago } from '@/app/admin/configuracoes/mercado-pago/actions'
import type { MercadoPagoAccount } from '@/lib/types'
import type { MercadoPagoAccountDetails } from '@/lib/mercadoPago'

export default function MercadoPagoCard({
  account,
  details,
  error,
  justConnected,
}: {
  account: Pick<MercadoPagoAccount, 'live_mode' | 'connected_at'> | null
  // Apelido/e-mail de quem está conectado, buscados na hora na API do
  // Mercado Pago — null quando a busca falha (a conexão em si continua
  // valendo, só não dá pra confirmar visualmente qual conta é).
  details?: MercadoPagoAccountDetails | null
  error?: string
  justConnected?: boolean
}) {
  return (
    <section className="flex flex-col gap-3 border border-line rounded-xl p-4">
      <div>
        <h2 className="text-sm font-bold">Mercado Pago</h2>
        <p className="text-xs text-muted">
          Conecte para o cliente pagar o pedido pelo link de acompanhamento (Pix, cartão ou boleto). O dinheiro cai
          direto na conta da loja.
        </p>
      </div>

      {error && <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg p-3">{error}</p>}
      {justConnected && !error && (
        <p className="text-xs text-green-700 bg-green-50 border border-green-200 rounded-lg p-3">
          Conta conectada com sucesso!
        </p>
      )}

      {account ? (
        <div className="flex flex-col gap-3">
          <div
            className={`flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-bold ${
              account.live_mode ? 'bg-red-50 text-red-700 border border-red-200' : 'bg-green-50 text-green-700 border border-green-200'
            }`}
          >
            <span className={`w-2 h-2 rounded-full ${account.live_mode ? 'bg-red-600' : 'bg-green-600'}`} />
            {account.live_mode ? 'PRODUÇÃO — cobra dinheiro real' : 'Ambiente de testes — não cobra dinheiro real'}
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="text-sm">
              <p className="font-semibold">
                Conectado{details?.nickname ? ` como ${details.nickname}` : ''}
              </p>
              <p className="text-xs text-muted">
                {details?.email ? `${details.email} · ` : !details ? 'Não foi possível confirmar a conta agora · ' : ''}
                desde {new Date(account.connected_at).toLocaleDateString('pt-BR')}
              </p>
            </div>
            <form action={disconnectMercadoPago}>
              <button
                type="submit"
                className="border border-line rounded-lg px-3 py-1.5 text-xs font-semibold text-red-600 hover:bg-red-50"
              >
                Desconectar
              </button>
            </form>
          </div>
        </div>
      ) : (
        <a
          href="/admin/configuracoes/mercado-pago/connect"
          className="bg-accent text-white rounded-lg px-4 py-2 text-sm font-bold w-fit"
        >
          Conectar Mercado Pago
        </a>
      )}
    </section>
  )
}
