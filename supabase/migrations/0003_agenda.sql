-- =============================================================================
-- 0003 — A agenda, dentro do banco
--
-- Substitui o Google Calendar e os workflows "3- Agendamento" e "4- Marcação de
-- consulta" do n8n. A diferença que importa: lá, "o horário está livre?" era uma
-- pergunta ao Google feita pelo n8n, e duas conversas ao mesmo tempo podiam
-- receber "sim" para o mesmo horário. Aqui quem garante é o próprio banco:
--
--   • fora do horário do advogado        → recusado (trigger abaixo)
--   • dois clientes no mesmo horário     → impossível (exclusion constraint, 0001)
--
-- E isso vale para as duas portas: a tela (Agenda / Agendamentos) e a
-- secretária de IA. Não existe caminho que pule a regra.
-- =============================================================================


-- -----------------------------------------------------------------------------
-- 1. O HORÁRIO CABE NA JORNADA DO ADVOGADO?
--
-- A conta é em SEGUNDOS DESDE A MEIA-NOITE, somados — nunca reconvertidos para
-- hora do dia. Uma consulta às 23:30 de 60 min termina 00:30, e `::time`
-- devolveria 00:30 (menor que o fim do expediente) e aceitaria.
-- -----------------------------------------------------------------------------
create or replace function public.dentro_da_jornada(
  p_advogado uuid,
  p_inicio   timestamptz,
  p_duracao  int
)
returns boolean
language sql
stable
as $$
  with q as (
    select (p_inicio at time zone public.fuso_escritorio()) as local
  )
  select exists (
    select 1
      from public.advogado_hours h
      join public.advogados a on a.id = h.advogado_id
     cross join q
     where h.advogado_id = p_advogado
       and a.ativo
       and h.aberto
       and h.dia = public.dia_semana_de(extract(dow from q.local)::int)
       and extract(epoch from q.local::time) >= extract(epoch from h.hora_inicio)
       and extract(epoch from q.local::time) + (p_duracao * 60) <= extract(epoch from h.hora_fim)
  );
$$;


-- -----------------------------------------------------------------------------
-- 2. A TRAVA — vale para a tela e para a secretária
-- -----------------------------------------------------------------------------
create or replace function public.agendamento_confere_jornada()
returns trigger
language plpgsql
as $$
declare
  v_minutos int;
begin
  if new.status not in ('agendado', 'confirmado') then
    return new;
  end if;

  -- Só confere quando o horário, o advogado ou a reativação mudaram. Dar baixa
  -- (compareceu) numa consulta antiga não pode ser recusado porque a jornada do
  -- advogado mudou depois.
  if tg_op = 'UPDATE'
     and old.data_hora_inicio = new.data_hora_inicio
     and old.data_hora_fim    = new.data_hora_fim
     and old.advogado_id      = new.advogado_id
     and old.status in ('agendado', 'confirmado') then
    return new;
  end if;

  v_minutos := ceil(extract(epoch from (new.data_hora_fim - new.data_hora_inicio)) / 60)::int;

  if not public.dentro_da_jornada(new.advogado_id, new.data_hora_inicio, v_minutos) then
    raise exception 'fora_da_jornada'
      using errcode = 'P0001',
            hint = 'O horário está fora da jornada de atendimento deste advogado.';
  end if;

  return new;
end;
$$;

create trigger agendamento_confere_jornada
  before insert or update on public.agendamentos_adv
  for each row execute function public.agendamento_confere_jornada();


-- -----------------------------------------------------------------------------
-- 3. QUEM ESTÁ LIVRE NUM HORÁRIO
-- -----------------------------------------------------------------------------
create or replace function public.agenda_advogados_livres(
  p_inicio  timestamptz,
  p_duracao int default null
)
returns table (advogado_id uuid, nome text)
language sql
stable
as $$
  with d as (
    select coalesce(p_duracao, (select duracao_consulta_min from public.office_config where id = 1), 60) as min
  )
  select a.id, a.nome
    from public.advogados a
   cross join d
   where a.ativo
     and public.dentro_da_jornada(a.id, p_inicio, d.min)
     and not exists (
       select 1 from public.agendamentos_adv g
        where g.advogado_id = a.id
          and g.status in ('agendado', 'confirmado')
          and tstzrange(g.data_hora_inicio, g.data_hora_fim, '[)')
              && tstzrange(p_inicio, p_inicio + make_interval(mins => d.min), '[)')
     )
   order by a.nome;
$$;


-- -----------------------------------------------------------------------------
-- 4. HORÁRIOS LIVRES DE UM DIA
--
-- Passo de 30 min dentro da jornada de cada advogado. Só horário FUTURO:
-- oferecer o que já passou é pior do que não oferecer — a pessoa aceita e a
-- recusa vem depois.
-- -----------------------------------------------------------------------------
create or replace function public.agenda_horarios_disponiveis(
  p_data     date,
  p_advogado uuid default null,
  p_duracao  int default null,
  p_passo    int default 30
)
returns table (horario timestamptz)
language sql
stable
as $$
  with cfg as (
    select public.fuso_escritorio() as fuso,
           coalesce(p_duracao, (select duracao_consulta_min from public.office_config where id = 1), 60) as min
  ),
  jornada as (
    select h.advogado_id, h.hora_inicio, h.hora_fim
      from public.advogado_hours h
      join public.advogados a on a.id = h.advogado_id
     where a.ativo
       and h.aberto
       and h.dia = public.dia_semana_de(extract(dow from p_data)::int)
       and (p_advogado is null or h.advogado_id = p_advogado)
  ),
  slots as (
    select j.advogado_id,
           (s at time zone cfg.fuso) as inicio
      from jornada j
     cross join cfg
     cross join lateral generate_series(
       (p_data + j.hora_inicio)::timestamp,
       (p_data + j.hora_fim)::timestamp - make_interval(mins => cfg.min),
       make_interval(mins => p_passo)
     ) as s
  )
  select distinct s.inicio
    from slots s
   cross join cfg
   where s.inicio > now()
     and not exists (
       select 1 from public.agendamentos_adv g
        where g.advogado_id = s.advogado_id
          and g.status in ('agendado', 'confirmado')
          and tstzrange(g.data_hora_inicio, g.data_hora_fim, '[)')
              && tstzrange(s.inicio, s.inicio + make_interval(mins => cfg.min), '[)')
     )
   order by 1;
$$;


-- -----------------------------------------------------------------------------
-- 5. PRÓXIMO DIA COM VAGA — evita a secretária perguntar dia a dia
-- -----------------------------------------------------------------------------
create or replace function public.agenda_proxima_vaga(
  p_a_partir_de date,
  p_advogado    uuid default null
)
returns timestamptz
language plpgsql
stable
as $$
declare
  v_horario timestamptz;
begin
  for i in 0..60 loop
    select h.horario into v_horario
      from public.agenda_horarios_disponiveis(p_a_partir_de + i, p_advogado) h
     limit 1;
    if v_horario is not null then
      return v_horario;
    end if;
  end loop;
  return null;
end;
$$;


-- -----------------------------------------------------------------------------
-- 6. MARCAR
--
-- Recusa de negócio NÃO é exceção: volta `ok = false` com `motivo`, e a
-- secretária dá a notícia ao cliente. Exceção é só o que ninguém previu.
--
-- Motivos: data_passada · servico_desconhecido · modalidade_invalida ·
--          advogado_inexistente · fora_da_jornada · horario_ocupado ·
--          sem_advogado_livre · ja_tem_consulta · lead_inexistente
-- -----------------------------------------------------------------------------
create or replace function public.agenda_marcar(
  p_lead_id     uuid,
  p_nome        text,
  p_servico     text,
  p_modalidade  text,
  p_data_hora   timestamptz,
  p_advogado_id uuid default null,
  p_chave       text default null
)
returns table (
  ok             boolean,
  motivo         text,
  agendamento_id uuid,
  data_hora      timestamptz,
  advogado       text,
  link_reuniao   text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_min      int;
  v_adv      uuid;
  v_adv_nome text;
  v_link     text;
  v_id       uuid;
  v_existe   record;
begin
  -- Idempotência: a mesma chave devolve o que já foi marcado.
  if p_chave is not null then
    select g.id, g.data_hora_inicio, a.nome, g.link_reuniao into v_existe
      from public.agendamentos_adv g
      join public.advogados a on a.id = g.advogado_id
     where g.chave_externa = p_chave;
    if found then
      return query select true, null::text, v_existe.id, v_existe.data_hora_inicio,
                          v_existe.nome, v_existe.link_reuniao;
      return;
    end if;
  end if;

  if not exists (select 1 from public.leads_adv where id = p_lead_id) then
    return query select false, 'lead_inexistente', null::uuid, null::timestamptz, null::text, null::text;
    return;
  end if;

  if p_data_hora <= now() then
    return query select false, 'data_passada', null::uuid, null::timestamptz, null::text, null::text;
    return;
  end if;

  if p_modalidade not in ('presencial', 'online') then
    return query select false, 'modalidade_invalida', null::uuid, null::timestamptz, null::text, null::text;
    return;
  end if;

  if p_servico is not null and not exists (
    select 1 from public.servicos_adv where nome = p_servico and ativo
  ) then
    return query select false, 'servico_desconhecido', null::uuid, null::timestamptz, null::text, null::text;
    return;
  end if;

  -- Uma consulta futura por vez. Quem já tem hora remarca, não acumula.
  select g.data_hora_inicio into v_existe
    from public.agendamentos_adv g
   where g.lead_id = p_lead_id
     and g.status in ('agendado', 'confirmado')
     and g.data_hora_inicio > now()
   order by g.data_hora_inicio
   limit 1;
  if found then
    return query select false, 'ja_tem_consulta', null::uuid, v_existe.data_hora_inicio, null::text, null::text;
    return;
  end if;

  v_min := coalesce((select duracao_consulta_min from public.office_config where id = 1), 60);

  if p_advogado_id is not null then
    if not exists (select 1 from public.advogados where id = p_advogado_id and ativo) then
      return query select false, 'advogado_inexistente', null::uuid, null::timestamptz, null::text, null::text;
      return;
    end if;
    if not public.dentro_da_jornada(p_advogado_id, p_data_hora, v_min) then
      return query select false, 'fora_da_jornada', null::uuid, null::timestamptz, null::text, null::text;
      return;
    end if;
    v_adv := p_advogado_id;
  else
    select l.advogado_id into v_adv
      from public.agenda_advogados_livres(p_data_hora, v_min) l
     limit 1;
    if v_adv is null then
      return query select false, 'sem_advogado_livre', null::uuid, null::timestamptz, null::text, null::text;
      return;
    end if;
  end if;

  select a.nome, case when p_modalidade = 'online'
                      then coalesce(nullif(a.link_sala, ''),
                                    (select nullif(link_reuniao_padrao, '') from public.office_config where id = 1))
                 end
    into v_adv_nome, v_link
    from public.advogados a where a.id = v_adv;

  begin
    insert into public.agendamentos_adv (
      advogado_id, lead_id, data_hora_inicio, data_hora_fim, status,
      servico, modalidade, link_reuniao, origem, chave_externa
    ) values (
      v_adv, p_lead_id, p_data_hora, p_data_hora + make_interval(mins => v_min), 'agendado',
      p_servico, p_modalidade, v_link, 'secretaria_ia', p_chave
    )
    returning id into v_id;
  exception
    when exclusion_violation then
      return query select false, 'horario_ocupado', null::uuid, null::timestamptz, null::text, null::text;
      return;
  end;

  update public.leads_adv
     set nome_lead      = coalesce(nullif(trim(p_nome), ''), nome_lead),
         motivo_contato = coalesce(motivo_contato, p_servico)
   where id = p_lead_id;

  return query select true, null::text, v_id, p_data_hora, v_adv_nome, v_link;
end;
$$;


-- -----------------------------------------------------------------------------
-- 7. REMARCAR — dia, hora, advogado, ou tudo de uma vez
--
-- `p_advogado_id` nulo = manter o advogado atual.
-- -----------------------------------------------------------------------------
create or replace function public.agenda_remarcar(
  p_agendamento_id uuid,
  p_lead_id        uuid,
  p_nova_data_hora timestamptz,
  p_advogado_id    uuid default null
)
returns table (ok boolean, motivo text, data_hora timestamptz, advogado text, link_reuniao text)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_ag       record;
  v_adv      uuid;
  v_min      int;
  v_adv_nome text;
  v_link     text;
begin
  select * into v_ag from public.agendamentos_adv
   where id = p_agendamento_id and lead_id = p_lead_id
     and status in ('agendado', 'confirmado');
  if not found then
    return query select false, 'nao_encontrada', null::timestamptz, null::text, null::text;
    return;
  end if;

  if p_nova_data_hora <= now() then
    return query select false, 'data_passada', null::timestamptz, null::text, null::text;
    return;
  end if;

  v_adv := coalesce(p_advogado_id, v_ag.advogado_id);
  v_min := ceil(extract(epoch from (v_ag.data_hora_fim - v_ag.data_hora_inicio)) / 60)::int;

  if not public.dentro_da_jornada(v_adv, p_nova_data_hora, v_min) then
    return query select false, 'fora_da_jornada', null::timestamptz, null::text, null::text;
    return;
  end if;

  select a.nome, case when v_ag.modalidade = 'online'
                      then coalesce(nullif(a.link_sala, ''),
                                    (select nullif(link_reuniao_padrao, '') from public.office_config where id = 1))
                 end
    into v_adv_nome, v_link
    from public.advogados a where a.id = v_adv;

  begin
    update public.agendamentos_adv
       set data_hora_inicio = p_nova_data_hora,
           data_hora_fim    = p_nova_data_hora + make_interval(mins => v_min),
           advogado_id      = v_adv,
           link_reuniao     = v_link,
           status           = 'agendado'
     where id = p_agendamento_id;
  exception
    when exclusion_violation then
      return query select false, 'horario_ocupado', null::timestamptz, null::text, null::text;
      return;
  end;

  return query select true, null::text, p_nova_data_hora, v_adv_nome, v_link;
end;
$$;


-- -----------------------------------------------------------------------------
-- 8. CANCELAR
-- -----------------------------------------------------------------------------
create or replace function public.agenda_cancelar(
  p_agendamento_id uuid,
  p_lead_id        uuid,
  p_motivo         text default null
)
returns table (ok boolean, motivo text, data_hora timestamptz)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_inicio timestamptz;
begin
  update public.agendamentos_adv
     set status = 'cancelado',
         observacoes = case when nullif(trim(p_motivo), '') is null then observacoes
                            else concat_ws(E'\n', observacoes, 'Cancelado pelo WhatsApp: ' || trim(p_motivo)) end
   where id = p_agendamento_id and lead_id = p_lead_id
     and status in ('agendado', 'confirmado')
  returning data_hora_inicio into v_inicio;

  if v_inicio is null then
    return query select false, 'nao_encontrada', null::timestamptz;
    return;
  end if;
  return query select true, null::text, v_inicio;
end;
$$;


-- -----------------------------------------------------------------------------
-- 9. QUEM PODE CHAMAR
--
-- Marcar, remarcar e cancelar recebem `p_lead_id` e confiam nele: são da
-- secretária (Edge Function, service_role). Expostas ao `anon`, qualquer pessoa
-- com a chave pública do site marcaria consulta em nome de qualquer lead.
-- A tela marca por INSERT direto, protegida pelo RLS e pelas travas acima.
-- -----------------------------------------------------------------------------
revoke execute on function public.agenda_marcar(uuid, text, text, text, timestamptz, uuid, text) from public, anon, authenticated;
revoke execute on function public.agenda_remarcar(uuid, uuid, timestamptz, uuid) from public, anon, authenticated;
revoke execute on function public.agenda_cancelar(uuid, uuid, text) from public, anon, authenticated;
grant execute on function public.agenda_marcar(uuid, text, text, text, timestamptz, uuid, text) to service_role;
grant execute on function public.agenda_remarcar(uuid, uuid, timestamptz, uuid) to service_role;
grant execute on function public.agenda_cancelar(uuid, uuid, text) to service_role;

revoke execute on function public.agenda_horarios_disponiveis(date, uuid, int, int) from anon;
revoke execute on function public.agenda_proxima_vaga(date, uuid) from anon;
revoke execute on function public.agenda_advogados_livres(timestamptz, int) from anon;
revoke execute on function public.agente_deve_responder(text) from anon;
