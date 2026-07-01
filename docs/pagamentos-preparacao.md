# Mireva Agenda - Pagamentos com Asaas

Esta etapa conecta o checkout recorrente do Asaas em ambiente sandbox. O sistema cria uma sessao de checkout, redireciona o usuario para o Asaas, salva o `provider_checkout_id` na assinatura do estabelecimento e processa eventos recebidos pelo webhook.

O processamento automatico por webhook deve ser ativado depois que a URL final for cadastrada no Asaas com um token proprio para o header `asaas-access-token`.

## Variaveis de ambiente

Use estas variaveis em `.env.local` e na Vercel quando a etapa de gateway for iniciada:

```env
PAYMENT_PROVIDER=asaas
PAYMENT_WEBHOOKS_ENABLED=false
ASAAS_ENVIRONMENT=sandbox
ASAAS_API_URL=https://api-sandbox.asaas.com
ASAAS_API_KEY=SUA_CHAVE_ASAAS_APENAS_SERVER_SIDE
ASAAS_WEBHOOK_TOKEN=SEU_TOKEN_DE_WEBHOOK_ASAAS_APENAS_SERVER_SIDE
```

Regras:

- `PAYMENT_WEBHOOKS_ENABLED` deve continuar `false` em desenvolvimento local se o webhook nao estiver cadastrado. Na Vercel, use `true` depois de cadastrar a URL no Asaas.
- `ASAAS_API_KEY` e `ASAAS_WEBHOOK_TOKEN` sao server-side. Nunca use `NEXT_PUBLIC_`.
- `ASAAS_WEBHOOK_TOKEN` deve ser o mesmo token configurado no Asaas para o header `asaas-access-token`. Nao use a chave de API como token de webhook.
- `ASAAS_API_URL=https://api-sandbox.asaas.com` deve ser usado no sandbox.
- `ASAAS_ENVIRONMENT=sandbox` deve ser usado para testes.
- `ASAAS_ENVIRONMENT=production` deve ser usado apenas quando a cobranca real for aprovada.

## Estrutura de assinatura

A tabela principal continua sendo `public.business_subscriptions`.

Ela guarda:

- plano interno: `plan_id`;
- status interno: `status`;
- limites comerciais: `max_professionals`, `max_services`;
- gateway: `provider`;
- cliente externo: `provider_customer_id`;
- assinatura externa: `provider_subscription_id`;
- plano externo: `provider_plan_id`;
- checkout/cobranca externa: `provider_checkout_id`;
- metodo de pagamento: `provider_payment_method`;
- status retornado pelo gateway: `provider_status`;
- inicio do ciclo: `started_at`;
- renovacao: `renews_at`;
- solicitacao de cancelamento: `cancel_requested_at`;
- cancelamento efetivo: `canceled_at`;
- cancelamento no fim do ciclo: `cancel_at_period_end`;
- dados tecnicos extras: `metadata`.

## Webhooks

A tabela `public.payment_webhook_events` registra os eventos recebidos do gateway.

Ela guarda:

- provider;
- id do evento no provider;
- tipo do evento;
- payload bruto em JSON;
- headers em JSON;
- hash SHA-256 do corpo recebido;
- status de processamento: `received`, `ignored`, `processed` ou `failed`;
- relacao opcional com estabelecimento e assinatura.

Seguranca:

- RLS esta ativo.
- `anon` e `authenticated` nao recebem permissao.
- Apenas `service_role` pode ler/escrever eventos.
- O endpoint valida o header `asaas-access-token` com `ASAAS_WEBHOOK_TOKEN` antes de processar o payload.
- Eventos repetidos com o mesmo `provider_event_id` sao tratados de forma idempotente.

## Endpoints

Checkout:

```txt
POST /api/payments/checkout
```

O endpoint:

- exige usuario autenticado;
- exige estabelecimento configurado;
- exige que o usuario seja `owner`;
- valida o plano escolhido;
- bloqueia checkout novo quando ja existe assinatura ativa gerenciada pelo Asaas;
- cria checkout recorrente no Asaas;
- grava `provider=asaas`, `provider_checkout_id`, `provider_payment_method`, `provider_status` e metadados tecnicos na assinatura.

Alteracao de plano:

```txt
PATCH /api/subscription
```

Regras:

- assinatura sem cobranca ativa pode alterar plano/ciclo e seguir para checkout normalmente;
- assinatura ativa gerenciada pelo Asaas nao abre novo checkout automaticamente;
- mudanca de plano ou ciclo em assinatura ativa vira `metadata.pending_plan_change`;
- a solicitacao pendente guarda plano atual, plano desejado, ciclo atual, ciclo desejado, usuario solicitante e `apply_timing=period_end`;
- a aplicacao operacional deve ocorrer no fim do ciclo para evitar dupla cobranca recorrente.

Webhook:

```txt
POST /api/payments/webhook
GET /api/payments/webhook
```

Com `PAYMENT_WEBHOOKS_ENABLED=false`, o `POST` responde como desativado e nao processa nada.
Com `PAYMENT_WEBHOOKS_ENABLED=true`, o endpoint valida o token, registra o evento em `payment_webhook_events` e atualiza a assinatura quando encontra o estabelecimento correspondente.

Eventos processados:

- `PAYMENT_CONFIRMED`, `PAYMENT_RECEIVED` e `CHECKOUT_PAID`: ativam a assinatura.
- `SUBSCRIPTION_CREATED` e `SUBSCRIPTION_UPDATED` com status externo `ACTIVE`: ativam ou atualizam a assinatura.
- `PAYMENT_OVERDUE` e `PAYMENT_CREDIT_CARD_CAPTURE_REFUSED`: marcam como `past_due`.
- `SUBSCRIPTION_INACTIVATED` e `SUBSCRIPTION_DELETED`: marcam como `canceled`.
- `PAYMENT_REFUNDED` e `PAYMENT_CHARGEBACK_REQUESTED`: marcam como `past_due`.

## Proximo passo

- Cadastrar a URL `https://SEU_DOMINIO/api/payments/webhook` no painel do Asaas.
- Definir `ASAAS_WEBHOOK_TOKEN` no Asaas e na Vercel.
- Ativar `PAYMENT_WEBHOOKS_ENABLED=true` na Vercel.
- Habilitar eventos de pagamento, assinatura e checkout no webhook do Asaas.
- Fazer um pagamento sandbox e confirmar que `business_subscriptions.status` muda para `active`.
