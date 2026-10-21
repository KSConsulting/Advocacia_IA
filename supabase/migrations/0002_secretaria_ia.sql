-- =============================================================================
-- 0002 — A secretária de IA e as conversas do WhatsApp
--
-- Substitui o que estava FORA do sistema:
--   • Chatwoot                 → `mensagens_whatsapp` + tela Conversas
--   • memória do n8n (Postgres `n8n_chat_histories`) → `mensagens_whatsapp`
--   • Redis (juntar mensagens picotadas) → a espera de 12 s na Edge Function
--   • configuração espalhada nos nós do n8n → `configuracoes_agente`
-- =============================================================================


-- -----------------------------------------------------------------------------
-- 1. MENSAGENS
-- -----------------------------------------------------------------------------
create table public.mensagens_whatsapp (
  id          uuid primary key default gen_random_uuid(),
  lead_id     uuid not null references public.leads_adv(id) on delete cascade,

  -- `lead`      — quem escreveu foi a pessoa no WhatsApp
  -- `agente`    — a secretária de IA
  -- `atendente` — alguém da equipe, pela tela Conversas
  autor       text not null check (autor in ('lead', 'agente', 'atendente')),

  tipo        text not null default 'texto'
                check (tipo in ('texto', 'audio', 'imagem', 'video', 'documento')),

  -- Em áudio, a TRANSCRIÇÃO; em foto, a DESCRIÇÃO. É o que a secretária lê e o
  -- que a equipe vê embaixo do balão.
  conteudo    text,

  -- Caminho no bucket `midias-whatsapp`. Nulo quando é só texto.
  midia_url   text,

  -- O id da mensagem no WhatsApp. Impede a mesma mensagem de entrar duas vezes
  -- quando a ponte reenvia o webhook — coisa que ela faz.
  id_externo  text unique,

  -- Quem da equipe escreveu, quando `autor = 'atendente'`.
  enviada_por uuid references auth.users(id) on delete set null,

  -- Lida pela EQUIPE (não por usuário). Escritório pequeno: qualquer um assume.
  lida        boolean not null default false,

  -- `follow_up` quando a mensagem foi um dos 3 follow-ups automáticos.
  origem      text,

  criada_em   timestamptz not null default now()
);

create index idx_mensagens_lead_data on public.mensagens_whatsapp (lead_id, criada_em desc);


-- -----------------------------------------------------------------------------
-- 2. CONFIGURAÇÃO DA SECRETÁRIA — uma linha só
-- -----------------------------------------------------------------------------
create table public.configuracoes_agente (
  id                int primary key default 1 check (id = 1),

  -- DESLIGADA por padrão. Rodar a migração não coloca ninguém para falar com
  -- cliente de verdade.
  ativo             boolean not null default false,

  nome_agente       text not null default 'Camila' check (length(trim(nome_agente)) >= 2),

  modelo            text not null default 'gpt-4.1-mini',

  -- Nulo = usar o prompt oficial (agente-ia/prompt.md, publicado com a função).
  prompt            text,

  -- MODO TESTE — ligado por padrão. Ligado, ela só responde aos números da
  -- lista; os demais ficam gravados em Conversas, para a equipe atender à mão.
  modo_teste        boolean not null default true,
  numeros_teste     text[] not null default '{}',

  -- Qual ponte de WhatsApp está ativa. As duas podem ter chave nas secrets;
  -- quem decide é esta coluna.
  provedor_whatsapp text not null default 'evolution'
                      check (provedor_whatsapp in ('evolution', 'uazapi')),

  -- Os 3 follow-ups automáticos (20 min, 24 h e 36 h de silêncio do lead).
  follow_up_ativo   boolean not null default true,

  updated_at        timestamptz not null default now()
);

create trigger configuracoes_agente_updated_at
  before update on public.configuracoes_agente
  for each row execute function public.set_updated_at();

insert into public.configuracoes_agente (id) values (1);


-- -----------------------------------------------------------------------------
-- 3. ELA DEVE RESPONDER A ESTE NÚMERO?
-- -----------------------------------------------------------------------------
create or replace function public.agente_deve_responder(p_whatsapp text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select c.ativo and (not c.modo_teste or p_whatsapp = any (c.numeros_teste))
    from public.configuracoes_agente c
   where c.id = 1;
$$;


-- -----------------------------------------------------------------------------
-- 4. A MENSAGEM DO LEAD MEXE NA FICHA
--
-- • `ultima_mensagem` — só conta mensagem DO LEAD. É o relógio do follow-up: há
--   quanto tempo a PESSOA está calada. Se a resposta da secretária contasse, o
--   relógio zeraria a cada resposta e nenhum follow-up sairia.
-- • O lead respondeu → o ciclo de follow-up recomeça (as 3 colunas zeram) e,
--   se estava em `follow_up`, ele volta para `conversando`.
-- -----------------------------------------------------------------------------
create or replace function public.mensagem_do_lead_atualiza_ficha()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.leads_adv
     set ultima_mensagem = new.criada_em,
         follow_up_1 = null,
         follow_up_2 = null,
         follow_up_3 = null,
         status = case when status = 'follow_up' then 'conversando'::lead_status else status end
   where id = new.lead_id;
  return new;
end;
$$;

create trigger mensagens_whatsapp_atualiza_lead
  after insert on public.mensagens_whatsapp
  for each row
  when (new.autor = 'lead')
  execute function public.mensagem_do_lead_atualiza_ficha();


-- -----------------------------------------------------------------------------
-- 5. A LISTA DA TELA CONVERSAS
--
-- `security_invoker`: a view respeita o RLS de quem consulta.
-- -----------------------------------------------------------------------------
create view public.conversas_lista
with (security_invoker = true)
as
select
  l.id                as lead_id,
  l.nome_lead,
  l.whatsapp_lead,
  l.status,
  l.motivo_contato,
  l.agente_pausado,
  u.conteudo          as ultima_conteudo,
  u.tipo              as ultima_tipo,
  u.autor             as ultima_autor,
  u.criada_em         as ultima_em,
  (select count(*) from public.mensagens_whatsapp m
    where m.lead_id = l.id and m.autor = 'lead' and not m.lida)::int as nao_lidas
from public.leads_adv l
join lateral (
  select m.conteudo, m.tipo, m.autor, m.criada_em
    from public.mensagens_whatsapp m
   where m.lead_id = l.id
   order by m.criada_em desc
   limit 1
) u on true;


-- -----------------------------------------------------------------------------
-- 6. RLS
-- -----------------------------------------------------------------------------
alter table public.mensagens_whatsapp   enable row level security;
alter table public.configuracoes_agente enable row level security;

-- Mensagens: a equipe lê e marca como lida. INSERT pela tela não existe — quem
-- grava é a Edge Function (com a service_role), que também manda pelo WhatsApp.
-- Gravar daqui criaria um balão que nunca chegou ao cliente.
create policy "autenticado_select" on public.mensagens_whatsapp
  for select to authenticated using (true);
create policy "autenticado_update" on public.mensagens_whatsapp
  for update to authenticated using (true) with check (true);

create policy "autenticado_select" on public.configuracoes_agente
  for select to authenticated using (true);
create policy "somente_admin_update" on public.configuracoes_agente
  for update to authenticated using (public.eh_admin()) with check (public.eh_admin());

alter publication supabase_realtime add table public.mensagens_whatsapp;


-- -----------------------------------------------------------------------------
-- 7. STORAGE — áudios e fotos que chegam pelo WhatsApp
--
-- PRIVADO. Caminho `{lead_id}/{mensagem_id}.{ext}` — a pasta é o lead, e é isso
-- que permite apagar tudo de uma pessoa sem varrer o bucket.
-- -----------------------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('midias-whatsapp', 'midias-whatsapp', false)
on conflict (id) do nothing;

create policy "midias_leitura_autenticado" on storage.objects
  for select to authenticated using (bucket_id = 'midias-whatsapp');
