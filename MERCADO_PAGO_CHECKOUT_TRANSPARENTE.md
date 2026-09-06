# Migração para Checkout Transparente (Mercado Pago)

Plano para sair do Checkout Pro atual (redirect para página hospedada do
Mercado Pago) para o Checkout Transparente (formulário de pagamento na
própria página, via Payment Brick / Card Payment Brick).

## Estado atual (referência)

Fluxo hoje, ponta a ponta:

1. [components/PayButton.tsx](components/PayButton.tsx) — botão client-side que faz `POST` para a rota abaixo e redireciona (`window.location.href`) para o `initPoint` retornado.
2. [app/api/acompanhar/[token]/pagar/route.ts](app/api/acompanhar/[token]/pagar/route.ts) — resolve o pedido pelo token público, valida que ainda não foi pago, chama `createCheckoutPreference`.
3. [lib/mercadoPago.ts:217](lib/mercadoPago.ts#L217) `createCheckoutPreference` — cria a preferência (`POST /checkout/preferences`) com o access token da loja conectada (`refreshIfNeeded`/`getAccount`) e devolve `init_point`.
4. Cliente paga na página do Mercado Pago (Pix, cartão ou boleto — MP decide a UI).
5. [app/api/mercado-pago/webhook/route.ts](app/api/mercado-pago/webhook/route.ts) — recebe a notificação assíncrona, confirma via `getPayment`, atualiza `payments`/`sales_orders`, baixa estoque na primeira aprovação e dispara o e-mail de confirmação.

Duas coisas do modelo atual já ajudam na migração:

- **Marketplace OAuth por loja já existe**: cada loja conectada tem seu próprio `access_token` (`mercado_pago_accounts`), reutilizável para criar pagamentos diretamente.
- **`public_key` já é salvo por loja** ([lib/mercadoPago.ts:117](lib/mercadoPago.ts#L117), campo `public_key` em `mercado_pago_accounts` — ver [lib/types.ts:216](lib/types.ts#L216)), que é exatamente o que o Brick precisa no front-end. Não precisa de migração de banco para isso.

## O que muda conceitualmente

| | Checkout Pro (hoje) | Checkout Transparente |
|---|---|---|
| UI de pagamento | Página do Mercado Pago | Formulário na sua página (Brick) |
| Dado do cartão | Nunca passa pelo seu domínio | Tokenizado no seu domínio via SDK MP.js (nunca toca seu backend — PCI scope continua baixo, SAQ A) |
| Criação da cobrança | `POST /checkout/preferences` | `POST /v1/payments` |
| Resultado do pagamento | Só via webhook (assíncrono) | Síncrono na resposta da criação **+** webhook (para status que mudam depois, ex. Pix/boleto) |
| Pix/Boleto | MP mostra QR code / linha digitável na página dele | Você recebe os dados na resposta da API e precisa renderizar (QR code, copia-e-cola, link do boleto) |
| Erros de pagamento | MP mostra a mensagem na página dele | Você mapeia `status_detail` para mensagem em português |

## Passo a passo

### Fase 0 — Decidir escopo
Recomendo começar só com **cartão** via Card Payment Brick, mantendo Pix/boleto no Checkout Pro atual como fallback por um tempo. Isso corta o trabalho de renderizar QR code/boleto na primeira etapa e reduz o raio de regressão. Migrar Pix/boleto depois, como fase separada.

### Fase 1 — Front-end: carregar o Brick
- Adicionar o SDK `https://sdk.mercadopago.com/js/v2` na página de pagamento (`app/acompanhar/[token]/...`).
- Criar `components/TransparentCheckout.tsx` (substitui `PayButton.tsx` nessa página) que:
  - Inicializa `new MercadoPago(publicKey)` com o `public_key` da loja (precisa vir do servidor para o client — hoje não é exposto, só o `access_token` fica em `lib/mercadoPago.ts` que é server-only).
  - Monta o `Card Payment Brick`, com o valor do pedido só para exibição.
  - No callback `onSubmit`, envia ao seu backend o `token` do cartão + `payment_method_id` + `installments` (nunca o valor — isso é recalculado no servidor a partir do pedido, do mesmo jeito que `createCheckoutPreference` já faz com `order.total`).

### Fase 2 — Back-end: nova função de criação de pagamento
- Em `lib/mercadoPago.ts`, criar `createPayment({ companyId, order, token, paymentMethodId, installments, payer })` chamando `POST /v1/payments` com o `access_token` da loja (mesmo padrão de `getAccount`/`refreshIfNeeded` que já existe).
- Enviar header `X-Idempotency-Key` (um UUID por tentativa) para evitar cobrança duplicada em retry/duplo clique.
- Trocar o corpo de `app/api/acompanhar/[token]/pagar/route.ts` (ou criar uma rota nova, ex. `.../pagar-cartao/route.ts`) para receber o token do Brick em vez de só criar a preferência — mas manter as mesmas validações que já existem hoje (pedido não pago, `total > 0`, loja conectada).

### Fase 3 — Unificar a lógica de "pagamento aprovado"
Hoje, avançar `sales_orders.status` para `confirmado`, chamar `commit_order_stock` e mandar o e-mail de confirmação só acontece dentro do webhook ([app/api/mercado-pago/webhook/route.ts:91-140](app/api/mercado-pago/webhook/route.ts#L91-L140)). Com o Transparente, a resposta de `POST /v1/payments` já pode vir `approved` na hora — então esse mesmo bloco de efeitos precisa rodar também na resposta síncrona.

Extrair esse trecho para uma função compartilhada, ex. `applyPaymentResult(payment)` em `lib/mercadoPago.ts` ou um novo `lib/paymentEffects.ts`, chamada tanto pela rota de criação de pagamento quanto pelo webhook. Isso já resolve de graça o problema de duas fontes tentando aplicar o mesmo efeito — a guarda de idempotência que já existe (`isFirstApproval` checando `order.paid_at` antes de mexer) continua funcionando igual, não importa quem chega primeiro.

### Fase 4 — Mapear erros para o usuário
`status_detail` do Mercado Pago (`cc_rejected_insufficient_amount`, `cc_rejected_bad_filled_security_code`, etc.) precisa virar mensagem em português no formulário — hoje isso é responsabilidade do MP. Um dicionário simples `status_detail → mensagem` resolve a maior parte dos casos comuns.

### Fase 5 — Pix e boleto (se entrar no escopo)
- `POST /v1/payments` com `payment_method_id: "pix"` devolve `point_of_interaction.transaction_data` com QR code (base64) e "copia e cola" — precisa de um componente novo para exibir isso e ficar dando polling/aguardando o webhook confirmar.
- Boleto (`payment_method_id: "bolbradesco"` etc.) devolve um link (`transaction_details.external_resource_url`) para o PDF — precisa de uma tela de "aguardando pagamento do boleto" com esse link.

### Fase 6 — Testes
- Usar os cartões de teste do Mercado Pago e, se quiser, `mcp__mercadopago__create_test_user` para simular um comprador de teste.
- Cobrir os três caminhos: aprovado na hora, rejeitado na hora, e pendente (Pix/boleto) confirmado depois via webhook.

### Fase 7 — Corte
Rodar as duas UIs em paralelo (Brick para cartão, Checkout Pro ainda disponível como link alternativo) até validar em produção, depois remover `PayButton.tsx`/o fluxo de preferência se decidir não manter Pix/boleto via Checkout Pro.

## Tamanho estimado do trabalho

Não é uma mudança pequena, mas também não é um projeto do zero — a parte de infraestrutura (OAuth por loja, `access_token`/`public_key` por conta, webhook, e-mail de confirmação) já existe e é reaproveitada quase toda. O esforço concentra em:

1. Componente novo de front-end com o Brick (médio).
2. Rota/função nova de criação de pagamento no back-end (pequeno-médio, mesmo padrão do que já existe).
3. Extrair a lógica de "pagamento aprovado" para ser compartilhada entre webhook e resposta síncrona (pequeno, mas importante fazer certo).
4. Pix/boleto, se entrar no escopo (médio — é a parte mais trabalhosa por exigir UI própria de QR code/boleto).
5. Testes ponta a ponta dos três status.

Se o escopo inicial for só cartão (Fase 0), dá para ter uma primeira versão funcional em bem menos trabalho que fazer tudo de uma vez.
