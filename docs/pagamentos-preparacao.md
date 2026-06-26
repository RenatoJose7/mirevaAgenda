# Mireva Agenda - Pagamentos com Asaas

Esta etapa conecta o checkout recorrente do Asaas em ambiente sandbox. O sistema cria uma sessao de checkout, redireciona o usuario para o Asaas e salva o `provider_checkout_id` na assinatura do estabelecimento.

O processamento automatico por webhook ainda fica desativado ate a URL final ser cadastrada no Asaas.

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

- `PAYMENT_WEBHOOKS_ENABLED` deve continuar `false` ate o webhook ser cadastrado e validado.
- `ASAAS_API_KEY` e `ASAAS_WEBHOOK_TOKEN` sao server-side. Nunca use `NEXT_PUBLIC_`.
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

A tabela `public.payment_webhook_events` foi criada para receber eventos futuros de gateway.

Ela guarda:

- provider;
- id do evento no provider;
- tipo do evento;
- payload bruto em JSON;
- headers em JSON;
- hash/assinatura futura;
- status de processamento: `received`, `ignored`, `processed` ou `failed`;
- relacao opcional com estabelecimento e assinatura.

Seguranca:

- RLS esta ativo.
- `anon` e `authenticated` nao recebem permissao.
- Apenas `service_role` pode ler/escrever eventos.

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
- cria checkout recorrente no Asaas;
- grava `provider=asaas`, `provider_checkout_id`, `provider_payment_method`, `provider_status` e metadados tecnicos na assinatura.

Webhook reservado:

```txt
POST /api/payments/webhook
GET /api/payments/webhook
```

Com `PAYMENT_WEBHOOKS_ENABLED=false`, o `POST` responde como desativado e nao processa nada.
Com `PAYMENT_WEBHOOKS_ENABLED=true`, o endpoint ainda retorna `501` ate a etapa de processamento dos eventos do Asaas.

## Proximo passo

- Cadastrar a URL `https://SEU_DOMINIO/api/payments/webhook` no painel do Asaas.
- Definir `ASAAS_WEBHOOK_TOKEN` no Asaas e na Vercel.
- Ativar `PAYMENT_WEBHOOKS_ENABLED=true`.
- Processar eventos de pagamento para atualizar `status`, `provider_subscription_id`, `renews_at` e inadimplencia.
