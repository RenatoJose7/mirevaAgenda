# Estabilizacao do MVP

Checklist da primeira rodada de fechamento do Mireva Agenda.

## Escopo desta etapa

- RLS ligado nas tabelas publicas do produto.
- Isolamento por estabelecimento via `business_members`.
- Service role apenas no servidor.
- Login, sessao, callback OAuth e onboarding com mensagens previsiveis.
- Projeto Supabase novo reproduzivel pelas migrations versionadas.

## Tabelas com RLS obrigatorio

Estas tabelas devem retornar `rowsecurity = true`:

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
- `appointments`
- `customers`
- `internal_notifications`

SQL para conferir no Supabase SQL Editor:

```sql
select
  schemaname,
  tablename,
  rowsecurity
from pg_tables
where schemaname = 'public'
  and tablename in (
    'profiles',
    'businesses',
    'business_members',
    'professionals',
    'services',
    'professional_services',
    'professional_working_hours',
    'professional_breaks',
    'professional_booking_settings',
    'schedule_blocks',
    'appointments',
    'customers',
    'internal_notifications'
  )
order by tablename;
```

## Politicas esperadas

```sql
select
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd
from pg_policies
where schemaname = 'public'
order by tablename, policyname;
```

Todas as politicas de dados operacionais devem filtrar pelo estabelecimento associado ao usuario autenticado em `business_members`. `anon` nao deve ter politica direta de leitura/escrita nessas tabelas.

## Teste manual de isolamento

1. Criar conta A e concluir onboarding com um estabelecimento A.
2. Criar profissional, servico, disponibilidade e um agendamento em A.
3. Sair.
4. Criar conta B e concluir onboarding com estabelecimento B.
5. Confirmar que B nao ve profissionais, servicos, agenda, clientes ou notificacoes de A.
6. No navegador, tentar abrir URLs internas de A estando logado em B. O retorno esperado e tela vazia/sem dados ou erro controlado, nunca dados de A.
7. Repetir o teste invertendo A/B.

## Teste de Supabase novo

1. Criar projeto novo.
2. Copiar `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` e `SUPABASE_SERVICE_ROLE_KEY` para `.env.local`.
3. Rodar:

```powershell
npx supabase link --project-ref SEU_PROJECT_REF
npx supabase db push
```

4. No SQL Editor, rodar:

```sql
notify pgrst, 'reload schema';
```

5. Reiniciar `npm run dev`.
6. Testar cadastro, login, onboarding, criacao de profissional, servico e agendamento publico.

## Configuracao de Auth recomendada

No Dashboard do Supabase, abra `Authentication` > `Security` e ative a protecao contra senhas vazadas quando o projeto for para producao. O advisor de seguranca do Supabase aponta isso como aviso quando a opcao esta desligada.

## Pontos de seguranca revisados

- `SUPABASE_SERVICE_ROLE_KEY` fica apenas em helpers server/API.
- Componentes client usam somente a chave publica.
- Callback OAuth sanitiza `next` para aceitar apenas caminhos internos.
- A migration `20260614022212_etapa_5_2_mvp_stabilization.sql` reaplica RLS de forma idempotente e corrige grants de `profiles` para o onboarding com service role.
- A migration `20260614022716_etapa_5_2_grants_hardening.sql` remove grants diretos de `anon` nas tabelas do produto e deixa `authenticated` com privilegios minimos.
- A migration `20260614022823_etapa_5_2_function_search_path.sql` fixa `search_path` nas funcoes publicas apontadas pelo advisor de seguranca.
