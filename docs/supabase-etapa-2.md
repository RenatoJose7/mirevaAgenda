# Mireva Agenda - Etapa 2 Supabase

Esta etapa conecta autenticacao real, estabelecimento/tenant e isolamento inicial. Agenda, servicos, profissionais e reservas continuam demonstrativos.

## Variaveis de ambiente

Crie `.env.local` a partir de `.env.example`:

```env
NEXT_PUBLIC_SUPABASE_URL=https://SEU_PROJETO.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_...
```

Use a Publishable Key atual do Supabase. Se o projeto ainda usar chave anon legada, coloque a anon key no mesmo campo `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`. Nunca use service role no navegador.

## Aplicar migration

Depois de vincular o projeto Supabase:

```bash
npx supabase link --project-ref SEU_PROJECT_REF
npx supabase db push
```

Ou copie o SQL de `supabase/migrations/20260607234849_etapa_2_auth_multiempresa.sql` para o SQL Editor do Supabase.

## Google OAuth

No Supabase Dashboard:

1. Acesse Authentication > Providers > Google.
2. Ative o provider.
3. Informe Client ID e Client Secret criados no Google Cloud.
4. Em Authentication > URL Configuration, adicione:
   - `http://localhost:3000/auth/callback`
   - `http://localhost:3000/**`
5. No Google Cloud, adicione a URL de callback indicada pelo Supabase para o provider Google.

Para producao, adicione tambem a URL do dominio final da Vercel.

## RLS e isolamento

Tabelas criadas:

- `profiles`: cada usuario le e atualiza apenas o proprio perfil.
- `businesses`: usuario autenticado le apenas negocios em que e membro; owner pode atualizar o proprio negocio.
- `business_members`: usuario le apenas memberships em que ele mesmo participa.

A criacao do negocio ocorre pela RPC publica `create_business_for_current_user`, que chama uma funcao privilegiada no schema privado `private`. Ela usa `auth.uid()` e nao aceita `user_id` vindo do cliente, criando o negocio e o vinculo owner na mesma transacao.

## Teste manual de isolamento

1. Crie o usuario A.
2. Conclua o onboarding com um negocio A.
3. Faca logout.
4. Crie o usuario B.
5. Conclua o onboarding com um negocio B.
6. Confirme que o dashboard do usuario B mostra apenas o negocio B.
7. No SQL Editor, valide que `business_members` tem dois usuarios diferentes.
8. Usando o app autenticado como A, tente consultar negocios de B pela API. A RLS deve bloquear.

## O que ainda e mock

- Indicadores do dashboard.
- Agenda.
- Profissionais.
- Servicos.
- Notificacoes.
- Pagina publica de agendamento.
- Confirmacao, remarcacao e cancelamento publicos.
