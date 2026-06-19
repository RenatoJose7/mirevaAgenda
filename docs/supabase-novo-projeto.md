# Trocar ou criar um novo Supabase para o Mireva Agenda

Este guia prepara um projeto Supabase novo para o Mireva Agenda sem alterar o codigo do app.

## 1. Criar o projeto

1. Acesse o dashboard do Supabase.
2. Crie uma organizacao/projeto para o Mireva Agenda.
3. Escolha a regiao `South America (Sao Paulo)` quando a latencia para usuarios no Brasil for prioridade.
4. Aguarde o banco ficar `Healthy`.

## 2. Copiar variaveis para `.env.local`

No Supabase, abra `Project Settings` > `API` e copie:

```env
NEXT_PUBLIC_SUPABASE_URL=https://SEU_PROJECT_REF.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=SUA_CHAVE_PUBLICA
SUPABASE_SERVICE_ROLE_KEY=SUA_CHAVE_SECRETA_SERVER_SIDE
```

Regras:

- `NEXT_PUBLIC_SUPABASE_URL` e `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` podem ir para o navegador.
- `SUPABASE_SERVICE_ROLE_KEY` nunca pode ser usada em componente client, arquivo com `"use client"` ou variavel `NEXT_PUBLIC_`.
- Depois de trocar `.env.local`, reinicie `npm run dev`.

## 3. Aplicar migrations versionadas

As migrations versionadas ficam em `supabase/migrations` e devem ser aplicadas em ordem pelo Supabase CLI.

Crie um access token no Supabase em `Account Settings` > `Access Tokens`. Nao compartilhe esse token.

```powershell
$env:SUPABASE_ACCESS_TOKEN="COLE_SEU_TOKEN_AQUI"
npx supabase link --project-ref SEU_PROJECT_REF
npx supabase db push
npx supabase db query "notify pgrst, 'reload schema';" --linked
```

Se preferir usar o SQL Editor, execute os arquivos de `supabase/migrations` em ordem cronologica e finalize com:

```sql
notify pgrst, 'reload schema';
```

## 4. Conferir Data API

Projetos novos do Supabase podem exigir grants explicitos para as tabelas aparecerem na Data API. A migration da Etapa 5.1 inclui grants para `service_role` e mantem RLS nas tabelas publicas.

Se aparecer erro `PGRST205` ou mensagem de schema cache:

1. Confirme que as migrations foram aplicadas no projeto correto.
2. Rode `notify pgrst, 'reload schema';`.
3. Reinicie o servidor local.
4. Confira em `Project Settings` > `API` se a URL e as chaves usadas no `.env.local` sao do mesmo projeto.

## 5. Configurar Auth

Em `Authentication` > `URL Configuration`:

- Site URL local: `http://localhost:3000`
- Redirect URLs locais:
  - `http://localhost:3000/auth/callback`
  - `http://localhost:3000/auth/callback?next=/onboarding`

Para producao, adicione os mesmos caminhos usando o dominio real.

Em `Authentication` > `Email Templates` > `Confirm signup`, troque o template padrao que usa link por um template que mostre o codigo de confirmacao. O cadastro do Mireva Agenda verifica o codigo digitado pelo usuario com `verifyOtp`.

Assunto sugerido:

```text
Codigo de verificacao - Mireva Agenda
```

Corpo sugerido:

```html
<h2>Codigo de verificacao do Mireva Agenda</h2>
<p>Digite este codigo na tela de cadastro para continuar:</p>
<h1 style="font-size: 32px; letter-spacing: 6px;">{{ .Token }}</h1>
<p>Se voce nao criou esta conta, ignore este e-mail.</p>
```

Se o template continuar usando apenas `{{ .ConfirmationURL }}`, o Supabase vai enviar link em vez de codigo. Depois de salvar o template, faca um novo cadastro de teste para receber um e-mail novo.

## 6. Google OAuth

1. No Google Cloud, crie ou selecione um OAuth Client.
2. Configure o redirect do Google para o callback informado pelo Supabase em `Authentication` > `Providers` > `Google`.
3. No Supabase, ative `Google` e cole Client ID e Client Secret.
4. Teste login por Google em `/login` e cadastro por Google em `/cadastro`.

## 7. Teste minimo depois da troca

1. Rodar `npm run build`.
2. Entrar com e-mail/senha ou Google.
3. Concluir onboarding.
4. Criar profissional e servico.
5. Vincular servico ao profissional.
6. Configurar disponibilidade em `/agenda`.
7. Abrir `/` e buscar o estabelecimento.
8. Criar uma reserva publica em `/agendar/[slug]`.

## 8. Conferir estabilizacao e isolamento

Depois de aplicar as migrations, siga o checklist em `docs/estabilizacao-mvp.md`.

O ponto mais importante: crie duas contas diferentes e confirme que uma conta nao enxerga dados da outra. As migrations usam RLS em todas as tabelas publicas do produto e isolam dados por `business_members`.
