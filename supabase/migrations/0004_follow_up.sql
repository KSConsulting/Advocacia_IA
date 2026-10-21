-- =============================================================================
-- 0004 — Follow-up automático (20 min, 24 h e 36 h)
--
-- Substitui os três workflows "Follow UP" do n8n. Eles rodavam a cada 10 min,
-- das 8h às 21h, e mandavam uma mensagem curta escrita pela IA para quem parou
-- de responder. A mesma ideia, com dois defeitos corrigidos:
--
--   • Os workflows de 24 h e 36 h conferiam e gravavam `follow_up_1` (cópia do
--     de 20 min) — o 2º e o 3º nunca eram registrados como tais.
--   • Nada impedia os três de saírem em sequência para quem estava calado havia
--     dias quando o follow-up foi ligado. Aqui há um intervalo mínimo entre eles.
--
-- Quem roda: `pg_cron` chama a Edge Function `follow-up` a cada 10 minutos.
-- Quem decide QUEM recebe: a função `leads_para_follow_up()`, aqui no banco.
-- Quem escreve e envia: a Edge Function.
-- =============================================================================

create extension if not exists pg_cron;
create extension if not exists pg_net with schema extensions;


-- -----------------------------------------------------------------------------
-- 1. QUEM ESTÁ DEVENDO RESPOSTA
--
-- Entra quem, ao mesmo tempo:
--   • está em novo_contato, conversando ou follow_up (não agendou, não fechou)
--   • não teve a conversa assumida pela equipe (`agente_pausado`)
--   • tem como ÚLTIMA mensagem da conversa uma nossa — ele é quem está calado
--   • não tem consulta futura marcada
--   • passa no modo teste da secretária (`agente_deve_responder`)
--   • está calado há tempo suficiente para a próxima etapa:
--       1º → 20 min de silêncio
--       2º → 24 h de silêncio, e 12 h depois do 1º
--       3º → 36 h de silêncio, e  6 h depois do 2º
--
-- E só no horário de mandar mensagem: 08:00–20:59 no fuso do escritório.
-- -----------------------------------------------------------------------------
create or replace function public.leads_para_follow_up()
returns table (lead_id uuid, whatsapp text, etapa int)
language sql
stable
security definer
set search_path = public
as $$
  with cfg as (
    select c.ativo, c.follow_up_ativo
      from public.configuracoes_agente c where c.id = 1
  ),
  agora as (
    select extract(hour from (now() at time zone public.fuso_escritorio()))::int as hora
  )
  select l.id,
         l.whatsapp_lead,
         case when l.follow_up_1 is null then 1
              when l.follow_up_2 is null then 2
              else 3 end
    from public.leads_adv l
   cross join cfg
   cross join agora
   where cfg.ativo
     and cfg.follow_up_ativo
     and agora.hora between 8 and 20
     and l.status in ('novo_contato', 'conversando', 'follow_up')
     and not l.agente_pausado
     and l.ultima_mensagem is not null
     and l.follow_up_3 is null
     and public.agente_deve_responder(l.whatsapp_lead)
     and (
       select m.autor from public.mensagens_whatsapp m
        where m.lead_id = l.id
        order by m.criada_em desc
        limit 1
     ) in ('agente', 'atendente')
     and not exists (
       select 1 from public.agendamentos_adv g
        where g.lead_id = l.id
          and g.status in ('agendado', 'confirmado')
          and g.data_hora_inicio > now()
     )
     and (
          (l.follow_up_1 is null
             and now() - l.ultima_mensagem >= interval '20 minutes')
       or (l.follow_up_1 is not null and l.follow_up_2 is null
             and now() - l.ultima_mensagem >= interval '24 hours'
             and now() - l.follow_up_1     >= interval '12 hours')
       or (l.follow_up_2 is not null and l.follow_up_3 is null
             and now() - l.ultima_mensagem >= interval '36 hours'
             and now() - l.follow_up_2     >= interval '6 hours')
     )
   order by l.ultima_mensagem
   limit 50;
$$;

revoke execute on function public.leads_para_follow_up() from public, anon, authenticated;
grant execute on function public.leads_para_follow_up() to service_role;


-- -----------------------------------------------------------------------------
-- 2. O DISPARO
--
-- A URL do projeto e o segredo NÃO estão escritos aqui: este arquivo é igual
-- em toda instalação. Eles moram no Vault do Supabase, com estes nomes:
--
--   select vault.create_secret('https://SEU_REF.supabase.co', 'projeto_url');
--   select vault.create_secret('o mesmo FOLLOW_UP_SEGREDO das secrets', 'follow_up_segredo');
--
-- (INSTALACAO.md, parte 3.) Sem os dois, o disparo não faz nada — e diz por
-- quê no log do Postgres, em vez de falhar calado.
-- -----------------------------------------------------------------------------
create or replace function public.disparar_follow_up()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_url     text;
  v_segredo text;
begin
  select decrypted_secret into v_url
    from vault.decrypted_secrets where name = 'projeto_url';
  select decrypted_secret into v_segredo
    from vault.decrypted_secrets where name = 'follow_up_segredo';

  if v_url is null or v_segredo is null then
    raise log 'follow-up: faltam os segredos projeto_url / follow_up_segredo no Vault';
    return;
  end if;

  perform net.http_post(
    url     := rtrim(v_url, '/') || '/functions/v1/follow-up',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-follow-up-segredo', v_segredo
    ),
    body    := '{}'::jsonb,
    timeout_milliseconds := 5000
  );
end;
$$;

revoke execute on function public.disparar_follow_up() from public, anon, authenticated;

select cron.schedule('follow-up-secretaria', '*/10 * * * *', 'select public.disparar_follow_up()');
