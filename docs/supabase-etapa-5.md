# Mireva Agenda - Etapa 5 MVP funcional

Esta etapa estabiliza autenticacao/onboarding e transforma o agendamento publico em fluxo real, com dados minimos de cliente, appointments, painel, cancelamento/remarcacao por token e notificacoes internas.

## Variaveis de ambiente

```env
NEXT_PUBLIC_SUPABASE_URL=https://eazizojxtjzwawrajwli.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_ou_anon_public
SUPABASE_SERVICE_ROLE_KEY=sua_service_role_key
```

`SUPABASE_SERVICE_ROLE_KEY` e apenas server-side. Nunca use `NEXT_PUBLIC_` nela e nunca exponha no navegador.

## Migration

Arquivo criado:

```bash
supabase/migrations/20260608142358_etapa_5_mvp_booking.sql
```

Aplicar:

```bash
npx supabase link --project-ref eazizojxtjzwawrajwli
npx supabase db push
```

## Tabelas envolvidas

- `profiles`
- `businesses`
- `business_members`
- `professionals`
- `services`
- `professional_services`
- `professional_working_hours`
- `professional_breaks`
- `professional_booking_settings`
- `schedule_blocks`
- `customers`
- `appointments`
- `internal_notifications`

## Novidades de banco

- `customers`: dados minimos do cliente final.
- `appointments`: tokens de cancelamento/remarcacao, customer_id, notas minimas e status `completed`.
- `internal_notifications`: eventos internos do painel.
- `professional_booking_settings`: prazos de cancelamento/remarcacao.

## Seguranca

- Tabelas internas continuam com RLS.
- `customers` e `internal_notifications` tem RLS e grants apenas para `authenticated`.
- O cliente final nao recebe login nem permissao direta de insert.
- Rotas publicas usam validação server-side e chave secreta somente no servidor.
- Conflitos continuam protegidos por trigger no banco.
- Dados sensiveis, prontuario, CPF e dados clinicos nao sao salvos.

## Fluxo de teste

1. Preencha `.env.local`.
2. Aplique as migrations.
3. Rode `npm run dev`.
4. Crie conta em `/cadastro`.
5. Conclua `/onboarding`.
6. Cadastre profissionais em `/profissionais`.
7. Cadastre servicos e vinculos em `/servicos`.
8. Configure horarios, pausas e regras em `/agenda`.
9. Copie o link publico em `/configuracoes`.
10. Acesse `/agendar/[slug]` sem login.
11. Crie uma reserva.
12. Confira a reserva em `/agenda` e `/dashboard`.
13. Use o link de cancelamento.
14. Use o link de remarcacao.
15. Confira notificacoes em `/notificacoes`.

## Fora do escopo

- Pagamentos.
- WhatsApp API.
- IA.
- Aplicativo.
- Push notifications.
- Google Agenda.
- Painel administrativo interno da Mireva.
- Deploy/producao.
