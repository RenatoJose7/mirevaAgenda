update public.subscription_plans
set
  description = case id
    when 'basic' then 'Para autonomos que querem uma agenda simples.'
    when 'plus' then 'Para pequenas equipes que precisam organizar melhor os atendimentos.'
    when 'business' then 'Para negocios com mais profissionais, mais servicos e maior volume de agendamentos.'
    else description
  end,
  price_cents = case id
    when 'basic' then 3990
    when 'plus' then 8990
    when 'business' then 17990
    else price_cents
  end,
  updated_at = now()
where id in ('basic', 'plus', 'business');

notify pgrst, 'reload schema';
