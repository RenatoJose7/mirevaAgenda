# Mireva Agenda - Etapa 4 Supabase

Esta etapa implementa o motor interno de disponibilidade com horarios, pausas, regras e bloqueios por profissional. O fluxo publico de reserva continua sem gravar appointments reais.

## Migration

Arquivo criado:

```bash
supabase/migrations/20260608133134_etapa_4_availability_engine.sql
```

Para aplicar no projeto remoto:

```bash
npx supabase link --project-ref eazizojxtjzwawrajwli
npx supabase db push
```

## Tabelas criadas

- `professional_working_hours`: expediente semanal por profissional.
- `professional_breaks`: pausas semanais por profissional.
- `professional_booking_settings`: intervalo entre atendimentos, antecedencia minima, janela maxima e passo dos horarios.
- `schedule_blocks`: bloqueios por data, de dia inteiro ou intervalo.
- `appointments`: tabela minima interna para conflito de horarios. A pagina publica ainda nao insere registros.

## Seguranca

Todas as tabelas novas:

- possuem `business_id`;
- possuem RLS ativado;
- permitem `SELECT` apenas para membros do estabelecimento;
- permitem `INSERT` e `UPDATE` apenas para membros autenticados do estabelecimento com role `owner` ou `staff`;
- nao possuem grants para `anon`;
- usam soft delete/desativacao quando aplicavel.

Triggers no schema privado validam:

- `business_id` do profissional em horarios, pausas, configuracoes e bloqueios;
- `business_id` do profissional, servico e vinculo em appointments;
- sobreposicao de expedientes ativos;
- sobreposicao de pausas ativas;
- conflito de appointments ativos.

## Disponibilidade

A rota interna autenticada `POST /api/availability` calcula horarios usando o business da sessao. Ela nao aceita `business_id` vindo do frontend.

O calculo considera:

- profissional ativo;
- servico ativo;
- vinculo ativo servico-profissional;
- duracao customizada quando existir;
- expediente semanal;
- pausas;
- bloqueios;
- appointments ativos;
- intervalo entre atendimentos;
- antecedencia minima;
- janela maxima de agendamento.

## Teste manual

1. Cadastre um profissional ativo.
2. Cadastre um servico ativo e vincule ao profissional.
3. Acesse `/agenda`.
4. Configure expediente de segunda a sexta.
5. Salve as regras com intervalo de 15 minutos.
6. Adicione pausa de almoco.
7. Adicione bloqueio parcial.
8. Adicione bloqueio de dia inteiro.
9. Teste disponibilidade por servico, profissional e data.
10. Confirme que pausas e bloqueios removem horarios.
11. Teste uma data fora da janela maxima.
12. Crie outro estabelecimento/usuario e confirme que os dados nao cruzam.

## Continua mockado

- dashboard e metricas avancadas;
- notificacoes;
- pagina publica de reserva;
- confirmacao, cancelamento e remarcacao publicos;
- e-mail;
- WhatsApp API;
- pagamentos;
- IA;
- aplicativo.
