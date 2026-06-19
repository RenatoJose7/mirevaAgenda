# Mireva Agenda - Etapa 6 QA funcional

Data da rodada: 2026-06-19

Esta etapa fecha a primeira rodada de QA do MVP funcional. O foco foi validar o sistema funcionando, sem adicionar pagamentos, WhatsApp API, IA, aplicativo, Google Agenda ou painel administrativo Mireva.

## O que foi validado

- Build de producao do Next.js.
- Lint do projeto.
- Calculo de disponibilidade com conflito, pausa, bloqueio, duracao, buffer e antecedencia minima.
- Migrations locais alinhadas com o Supabase remoto.
- RLS habilitado nas 13 tabelas publicas esperadas do produto.
- Zero grants diretos para `anon` nas tabelas operacionais.
- Trava de banco contra duplo agendamento no mesmo profissional/data/horario.
- Rotas protegidas redirecionando usuario sem sessao para `/login`.
- Fluxo publico real:
  - cria estabelecimento temporario de QA;
  - cria profissional, servico, vinculo, horario e regras;
  - calcula disponibilidade;
  - cria agendamento publico;
  - tenta duplo agendamento no mesmo horario e recebe erro claro;
  - remarca a reserva;
  - cancela a reserva;
  - remove os dados temporarios.

## Comandos de verificacao

```bash
npm test
npm run test:qa-public-booking
npm run lint
npm run build
```

## Checagens Supabase

```bash
npx supabase migration list --linked
npx supabase db query --linked -o json --file supabase/checks/security_rls_grants.sql
npx supabase db query --linked -o json --file supabase/checks/booking_conflicts.sql
npx supabase db query --linked -o json --file supabase/checks/booking_conflict_guard_test.sql
```

Resultados desta rodada:

- `availability checks passed`
- `public booking QA passed`
- `rls_enabled_tables`: 13
- `rls_disabled_tables`: 0
- `anon_table_grants`: 0
- `booking_conflicts`: sem linhas
- `booking_conflict_guard_test`: `booking_conflict_guard_ok`
- Supabase advisor: apenas aviso de protecao contra senhas vazadas desativada no Auth.

## Correcoes feitas durante o QA

- `GET /api/public/[slug]/booking-data` agora filtra vinculos e configuracoes para retornar somente profissionais e servicos ativos que aparecem no fluxo publico.
- `.tmp/` foi ignorado no Git/ESLint para que artefatos de teste compilados nao quebrem `npm run lint`.
- `npm test` agora executa a checagem de disponibilidade.
- `npm run test:qa-public-booking` executa o fluxo publico completo com dados temporarios.

## Pendencias externas antes de producao

- Ativar protecao contra senhas vazadas no Supabase Auth.
- Confirmar template de e-mail/codigo ou manter fluxo por link conscientemente.
- Confirmar redirects de Auth para o dominio final quando houver deploy.
- Fazer uma rodada visual manual no navegador em desktop e mobile antes de divulgar.
