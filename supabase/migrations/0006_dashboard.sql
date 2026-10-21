-- =============================================================================
-- 0006 — Os números do Dashboard, contados no banco
--
-- A especificação descreve os cards e gráficos como COUNTs. Contar no navegador
-- (carregar os leads e somar) quebra calado: a API do Supabase devolve no máximo
-- 1000 linhas por consulta, e a partir daí o Dashboard passaria a mostrar 1000
-- leads para sempre, sem erro nenhum. Aqui a conta é do Postgres.
--
-- `security invoker` (padrão): roda com o RLS de quem pergunta.
-- =============================================================================

create or replace function public.dashboard_resumo(
  p_inicio timestamptz,
  p_fim    timestamptz
)
returns jsonb
language sql
stable
as $$
  with fuso as (
    select public.fuso_escritorio() as tz
  ),
  leads as (
    select (l.inicio_atendimento at time zone f.tz) as local
      from public.leads_adv l, fuso f
     where l.inicio_atendimento >= p_inicio
       and l.inicio_atendimento <  p_fim
  ),
  classificados as (
    select l.local,
           exists (
             select 1 from public.office_hours h
              where h.aberto
                and h.dia = public.dia_semana_de(extract(dow from l.local)::int)
                and l.local::time >= h.hora_inicio
                and l.local::time <  h.hora_fim
           ) as dentro
      from leads l
  )
  select jsonb_build_object(
    'total_leads', (select count(*) from leads),

    'total_clientes', (
      select count(*) from public.clientes_adv c
       where c.created_at >= p_inicio and c.created_at < p_fim
    ),

    -- "Consultas Hoje" NÃO segue o filtro: é sempre o dia de hoje.
    'consultas_hoje', (
      select count(*) from public.agendamentos_adv g, fuso f
       where (g.data_hora_inicio at time zone f.tz)::date = (now() at time zone f.tz)::date
         and g.status <> 'cancelado'
    ),

    'por_dia', coalesce((
      select jsonb_agg(jsonb_build_object('dia', d, 'total', t) order by d)
        from (select local::date as d, count(*) as t from leads group by 1) x
    ), '[]'::jsonb),

    -- 0 = domingo … 6 = sábado
    'por_dia_semana', (
      select jsonb_agg(jsonb_build_object('dow', s.dow, 'total', coalesce(x.t, 0)) order by s.dow)
        from generate_series(0, 6) as s(dow)
        left join (select extract(dow from local)::int as dow, count(*) as t from leads group by 1) x
          on x.dow = s.dow
    ),

    'dentro_horario', (select count(*) from classificados where dentro),
    'fora_horario',   (select count(*) from classificados where not dentro)
  );
$$;

revoke execute on function public.dashboard_resumo(timestamptz, timestamptz) from anon;
