import { disconnectMercadoPago, updateMinInstallmentAmount } from '@/app/admin/configuracoes/mercado-pago/actions'
import Card from '@/components/Card'
import Button from '@/components/Button'
import Alert from '@/components/Alert'
import type { MercadoPagoAccount } from '@/lib/types'
import type { MercadoPagoAccountDetails } from '@/lib/mercadoPago'

export default function MercadoPagoCard({
  account,
  details,
  error,
  justConnected,
}: {
  account: Pick<MercadoPagoAccount, 'live_mode' | 'connected_at' | 'min_installment_amount'> | null
  // Apelido/e-mail/produção-ou-teste de quem está conectado, buscados/
  // recalculados na hora — mais confiáveis que o `live_mode` gravado em
  // `account` (o valor que o Mercado Pago devolve no OAuth de marketplace
  // já veio errado em produção mesmo logando com usuário de teste).
  details?: MercadoPagoAccountDetails | null
  error?: string
  justConnected?: boolean
}) {
  const liveMode = details?.live_mode ?? account?.live_mode ?? false
  return (
    <Card as="section" tight className="flex flex-col gap-3">
      <div>
        <h2 className="text-sm font-bold">Mercado Pago</h2>
        <p className="text-xs text-muted">
          Conecte para o cliente pagar o pedido pelo link de acompanhamento (Pix, cartão ou boleto). O dinheiro cai
          direto na conta da loja.
        </p>
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
        <div className="flex flex-col gap-3">
          <Alert variant={liveMode ? 'danger' : 'success'} className="flex items-center gap-2 font-bold">
            <span className={`w-2 h-2 rounded-full ${liveMode ? 'bg-red-600' : 'bg-green-600'}`} />
            {liveMode ? 'PRODUÇÃO — cobra dinheiro real' : 'Ambiente de testes — não cobra dinheiro real'}
          </Alert>

          {!liveMode && (
            <Alert variant="warning" size="sm">
              Essa é uma conta de teste do Mercado Pago. Clientes reais não conseguem pagar com ela — o checkout
              mostra o erro <strong>&quot;Não é possível pagar com Mercado Pago&quot;</strong> para quem tentar pagar
              com uma conta ou cartão de verdade. Só use para testar com um comprador de teste. Antes de mandar o
              link de pagamento para um cliente de verdade, desconecte e conecte a conta real da loja.
            </Alert>
          )}

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
              <Button type="submit" variant="danger" size="sm">
                Desconectar
              </Button>
            </form>
          </div>

          <form action={updateMinInstallmentAmount} className="flex flex-col gap-1 border-t border-line pt-3">
            <label className="text-xs font-semibold" htmlFor="min_installment_amount">
              Valor mínimo por parcela (cartão de crédito)
            </label>
            <p className="text-xs text-muted">
              O número de parcelas oferecidas ao cliente é calculado automaticamente: total do pedido dividido por
              este valor (arredondado pra baixo, até 12x). Ex.: mínimo de R$ 50 num pedido de R$ 180 oferece até 3x.
            </p>
            <div className="flex items-center gap-2">
              <input
                type="number"
                id="min_installment_amount"
                name="min_installment_amount"
                min="0.01"
                step="0.01"
                defaultValue={account.min_installment_amount}
                className="input w-32"
              />
              <Button type="submit" variant="secondary" size="sm" className="hover:bg-ink/5">
                Salvar
              </Button>
            </div>
          </form>
        </div>
      ) : (
        <Button href="/admin/configuracoes/mercado-pago/connect" className="w-fit">
          Conectar Mercado Pago
        </Button>
      )}
    </Card>
  )
}
