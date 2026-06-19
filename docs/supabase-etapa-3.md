# Mireva Agenda - Etapa 3 Supabase

Esta etapa conecta configuracoes do estabelecimento, profissionais, servicos e vinculos servico-profissional ao Supabase. O produto continua sendo um SaaS geral de agendamentos.

## Migration

Arquivo criado:

```bash
supabase/migrations/20260608010409_etapa_3_business_services_professionals.sql
```

Para aplicar no projeto remoto:

```bash
npx supabase link --project-ref SEU_PROJECT_REF
npx supabase db push
```

Ou copie o SQL da migration para o SQL Editor do Supabase.

## Tabelas reais

- `professionals`: equipe do estabelecimento, com nome, cargo/especialidade, bio, status e soft delete.
- `services`: catalogo de servicos, com descricao, preco base, duracao base, status e soft delete.
- `professional_services`: vinculo entre profissional e servico, com preco/duracao personalizados opcionais.

## RLS

As tres tabelas novas usam RLS:

- Membros autenticados do estabelecimento podem consultar dados do proprio tenant.
- Apenas owners podem inserir ou atualizar profissionais, servicos e vinculos.
- Nao ha delete real exposto ao cliente; a interface usa soft delete com `deleted_at`.
- O vinculo `professional_services` valida por trigger que profissional e servico pertencem ao mesmo estabelecimento.

## Temas

A Etapa 3 troca os nomes de temas para opcoes gerais:

- `mireva`
- `essencial`
- `premium`
- `calmo`
- `editorial`

Temas antigos da etapa visual sao remapeados automaticamente pela migration.

## Teste manual sugerido

1. Preencha `.env.local` com URL e Publishable Key do Supabase.
2. Aplique as migrations.
3. Crie um usuario em `/cadastro`.
4. Conclua o onboarding.
5. Acesse `/configuracoes` e salve nome, slug, segmento, WhatsApp, endereco, tema e modo de confirmacao.
6. Acesse `/profissionais` e cadastre dois profissionais.
7. Acesse `/servicos`, crie um servico e vincule os profissionais com preco/duracao personalizados.
8. Crie outro usuario/estabelecimento e confirme que os dados do primeiro nao aparecem.

## Fora do escopo

- Motor de agenda.
- Reservas reais.
- Disponibilidade, bloqueios e pausas reais.
- Notificacoes reais ou realtime.
- E-mail, WhatsApp API, pagamentos e assinaturas.
- Storage/upload real de logo.
