# Mireva Agenda - Preparacao para pagamentos

Esta etapa prepara a base para cobranca recorrente, mas ainda nao integra gateway, nao cria checkout, nao chama API externa e nao ativa cobranca real.

## Variaveis de ambiente

Use estas variaveis em `.env.local` e na Vercel quando a etapa de gateway for iniciada:

```env
PAYMENT_PROVIDER=asaas
PAYMENT_WEBHOOKS_ENABLED=false
ASAAS_ENVIRONMENT=sandbox
ASAAS_API_KEY=SUA_CHAVE_ASAAS_APENAS_SERVER_SIDE
ASAAS_WEBHOOK_TOKEN=SEU_TOKEN_DE_WEBHOOK_ASAAS_APENAS_SERVER_SIDE
```

Regras:

- `PAYMENT_WEBHOOKS_ENABLED` deve continuar `false` ate a integracao real.
- `ASAAS_API_KEY` e `ASAAS_WEBHOOK_TOKEN` sao server-side. Nunca use `NEXT_PUBLIC_`.
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

## Endpoint preparado

Endpoint reservado:

```txt
POST /api/payments/webhook
GET /api/payments/webhook
```

Com `PAYMENT_WEBHOOKS_ENABLED=false`, o `POST` responde como desativado e nao processa nada.
Com `PAYMENT_WEBHOOKS_ENABLED=true`, o endpoint ainda retorna `501` ate a etapa real de integracao do gateway.

## Fora do escopo desta etapa

- Criar cliente no Asaas.
- Criar assinatura/cobranca no Asaas.
- Validar assinatura real do webhook.
- Atualizar plano automaticamente por pagamento.
- Tela de checkout.
- Pagamento real.
