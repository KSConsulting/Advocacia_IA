-- =============================================================================
-- 0001 — Schema base do Sistema de Gestão do Escritório de Advocacia
--
-- Fonte: docs/especificacao/1- banco-de-dados-adv.md (as 7 tabelas, os ENUMs,
-- os índices e os triggers). O que está aqui e NÃO está lá é correção de algo
-- que não rodaria, ou o que o n8n/Chatwoot faziam por fora e agora mora aqui.
-- Cada desvio está marcado com "DESVIO DA ESPECIFICAÇÃO".
-- =============================================================================


-- -----------------------------------------------------------------------------
-- PASSO 0 — TIMEZONE
--
-- Vale para sessões novas. As funções deste banco NÃO dependem disso: a sessão
-- do PostgREST pode rodar em UTC, então toda conta de "que dia é" usa
-- `fuso_escritorio()` explicitamente.
-- -----------------------------------------------------------------------------
alter database postgres set timezone to 'America/Sao_Paulo';

-- Necessária para a trava de horário sobreposto (exclusion constraint com `=`
-- em uuid junto de `&&` em intervalo).
create extension if not exists btree_gist;


-- -----------------------------------------------------------------------------
-- PASSO 1 — ENUMs (idênticos à especificação)
-- -----------------------------------------------------------------------------
create type lead_status as enum (
  'novo_contato',
  'conversando',
  'consulta_agendada',
  'compareceu',
  'follow_up',
  'fechado',
  'perdido'
);

create type agendamento_status as enum (
  'agendado',
  'confirmado',
  'compareceu',
  'faltou',
  'cancelado'
);

create type dia_semana as enum (
  'domingo',
  'segunda',
  'terca',
  'quarta',
  'quinta',
  'sexta',
  'sabado'
);


-- -----------------------------------------------------------------------------
-- USUÁRIOS
--
-- DESVIO DA ESPECIFICAÇÃO: a política "somente_admin" consulta uma tabela
-- `users` com coluna `role` que nenhum passo cria. Esta é ela.
--
-- O PRIMEIRO usuário criado vira `admin` sozinho; os seguintes nascem `equipe`.
-- Assim a instalação não precisa do `auth.create_user()` do PASSO 7, que não
-- existe no Supabase — o usuário é criado no painel (Authentication → Users).
-- -----------------------------------------------------------------------------
create table public.usuarios (
  id         uuid primary key references auth.users(id) on delete cascade,
  email      text,
  nome       text,
  role       text not null default 'equipe' check (role in ('admin', 'equipe')),
  created_at timestamptz not null default now()
);

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.usuarios (id, email, role)
  values (
    new.id,
    new.email,
    case when exists (select 1 from public.usuarios where role = 'admin')
         then 'equipe' else 'admin' end
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

create or replace function public.eh_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.usuarios where id = auth.uid() and role = 'admin'
  );
$$;


-- -----------------------------------------------------------------------------
-- PASSO 2 — TABELAS
-- -----------------------------------------------------------------------------

-- office_config — sempre uma linha (id = 1).
--
-- DESVIO DA ESPECIFICAÇÃO: além de nome/logo/favicon, guarda o que a
-- secretária de IA fala sobre o escritório (endereço, Instagram, site...). No
-- n8n isso estava escrito à mão dentro do prompt; aqui é dado, editado na tela.
create table public.office_config (
  id                   int primary key default 1 check (id = 1),
  nome                 text not null,
  logo_url             text,
  favicon_url          text,
  -- O que a secretária de IA conta ao cliente
  endereco             text,
  cidade               text,
  uf                   text,
  link_maps            text,
  instagram            text,
  site                 text,
  areas_atuacao        text,
  -- Agenda
  fuso_horario         text not null default 'America/Sao_Paulo',
  duracao_consulta_min int  not null default 60 check (duracao_consulta_min between 15 and 240),
  consulta_gratuita    boolean not null default true,
  -- Sala de reunião usada quando o advogado não tem a dele (Meet, Zoom...)
  link_reuniao_padrao  text,
  updated_at           timestamptz not null default now()
);

-- office_hours — uma linha por dia da semana.
create table public.office_hours (
  id          uuid primary key default gen_random_uuid(),
  dia         dia_semana not null unique,
  aberto      boolean not null default false,
  hora_inicio time,
  hora_fim    time,
  constraint check_horas check (
    (aberto = false) or (hora_inicio is not null and hora_fim is not null)
  )
);

-- advogados — cada um tem a própria agenda e cor.
--
-- DESVIO DA ESPECIFICAÇÃO: `especialidade` (a secretária diz com quem é a
-- consulta) e `link_sala` (a sala fixa de videoconferência do advogado — o
-- Google Calendar gerava um Meet por consulta; sem ele, a sala é do advogado).
create table public.advogados (
  id            uuid primary key default gen_random_uuid(),
  nome          text not null,
  cor           text not null default '#1B3A5C',
  ativo         boolean not null default true,
  especialidade text,
  link_sala     text,
  created_at    timestamptz not null default now()
);

create table public.advogado_hours (
  id          uuid primary key default gen_random_uuid(),
  advogado_id uuid not null references public.advogados(id) on delete cascade,
  dia         dia_semana not null,
  aberto      boolean not null default false,
  hora_inicio time,
  hora_fim    time,
  unique (advogado_id, dia),
  constraint check_horas_advogado check (
    (aberto = false) or (hora_inicio is not null and hora_fim is not null)
  )
);

-- leads_adv — tabela central.
--
-- DESVIOS DA ESPECIFICAÇÃO:
--
-- 1. SEM os 4 campos Chatwoot. O Chatwoot saiu do sistema: a conversa mora em
--    `mensagens_whatsapp` (migração 0002) e é vista na tela Conversas.
--
-- 2. SEM `minutos_ultima_mensagem` como coluna. `GENERATED ALWAYS AS (... NOW()
--    ...) STORED` não roda: o Postgres recusa expressão não imutável em coluna
--    gerada ("generation expression is not immutable"). E mesmo que rodasse,
--    STORED congelaria o valor no momento da escrita. O número é calculado na
--    leitura — no follow-up (0004) e na tela, a partir de `ultima_mensagem`.
--
-- 3. `inicio_atendimento` ganhou `default now()`: sem ele, lead criado à mão
--    ficaria fora de todo gráfico do Dashboard, que filtra por esta coluna.
--
-- 4. `agente_pausado`: a equipe "assume" a conversa na tela Conversas e a
--    secretária de IA para de responder àquele número. Era o "atribuir a um
--    agente" do Chatwoot.
create table public.leads_adv (
  id                 uuid primary key default gen_random_uuid(),
  nome_lead          text,
  whatsapp_lead      text not null unique,
  motivo_contato     text,
  resumo_conversa    text,
  status             lead_status not null default 'novo_contato',
  inicio_atendimento timestamptz default now(),
  -- Última mensagem DO LEAD (não da secretária). Ver trigger na 0002.
  ultima_mensagem    timestamptz,

  -- Follow ups (preenchidos pela função `follow-up` ao enviar cada um)
  follow_up_1        timestamptz,
  follow_up_2        timestamptz,
  follow_up_3        timestamptz,

  -- Referência rápida à próxima consulta. Mantida pelo trigger dos agendamentos.
  data_agendamento   timestamptz,
  id_agendamento     text,

  anotacoes          text,
  agente_pausado     boolean not null default false,
  created_at         timestamptz not null default now()
);

-- clientes_adv — promoção lógica do lead.
create table public.clientes_adv (
  id                   uuid primary key default gen_random_uuid(),
  lead_id              uuid not null unique references public.leads_adv(id) on delete cascade,
  data_primeira_visita date not null default current_date,
  created_at           timestamptz not null default now()
);

-- agendamentos_adv — cada consulta.
--
-- DESVIOS DA ESPECIFICAÇÃO:
--
-- 1. `lead_id` é obrigatório. Todo cliente É um lead (clientes_adv.lead_id), então
--    "lead_id OU cliente_id" sempre pode ser lead_id — e assim a consulta não
--    some da ficha quando o cliente volta a ser lead. `cliente_id` continua,
--    preenchido pelo trigger, e vira nulo se a promoção for desfeita.
-- 2. `servico`, `modalidade`, `link_reuniao`: o que o Google Calendar guardava.
-- 3. `chave_externa`: idempotência. Se a secretária repetir o pedido por
--    timeout, a mesma chave devolve a consulta já criada em vez de uma segunda.
-- 4. Trava de horário sobreposto no próprio banco (exclusion constraint):
--    duas consultas do mesmo advogado no mesmo horário são impossíveis, venham
--    da tela, da secretária ou de duas abas abertas ao mesmo tempo.
create table public.agendamentos_adv (
  id               uuid primary key default gen_random_uuid(),
  advogado_id      uuid not null references public.advogados(id),
  lead_id          uuid not null references public.leads_adv(id) on delete cascade,
  cliente_id       uuid references public.clientes_adv(id) on delete set null,
  data_hora_inicio timestamptz not null,
  data_hora_fim    timestamptz not null,
  status           agendamento_status not null default 'agendado',
  observacoes      text,
  servico          text,
  modalidade       text not null default 'presencial'
                     check (modalidade in ('presencial', 'online')),
  link_reuniao     text,
  origem           text not null default 'sistema'
                     check (origem in ('sistema', 'secretaria_ia')),
  chave_externa    text unique,
  created_at       timestamptz not null default now(),

  constraint check_fim_depois_do_inicio check (data_hora_fim > data_hora_inicio),
  constraint agendamentos_sem_sobreposicao exclude using gist (
    advogado_id with =,
    tstzrange(data_hora_inicio, data_hora_fim, '[)') with &&
  ) where (status in ('agendado', 'confirmado'))
);

-- servicos_adv — o catálogo que a secretária oferece.
--
-- DESVIO DA ESPECIFICAÇÃO: no n8n era uma planilha do Google Sheets lida pela
-- ferramenta `servicos_tool`. Agora é tabela, editada em Configurações.
create table public.servicos_adv (
  id         uuid primary key default gen_random_uuid(),
  categoria  text not null,
  nome       text not null unique,
  descricao  text,
  ativo      boolean not null default true,
  ordem      int not null default 0,
  created_at timestamptz not null default now()
);


-- -----------------------------------------------------------------------------
-- PASSO 3 — ÍNDICES (os da especificação + os que os filtros novos usam)
-- -----------------------------------------------------------------------------
create index idx_leads_adv_status      on public.leads_adv(status);
create index idx_leads_adv_inicio      on public.leads_adv(inicio_atendimento);
create index idx_leads_adv_ultima_msg  on public.leads_adv(ultima_mensagem);

create index idx_agend_advogado        on public.agendamentos_adv(advogado_id);
create index idx_agend_inicio          on public.agendamentos_adv(data_hora_inicio);
create index idx_agend_status          on public.agendamentos_adv(status);
create index idx_agend_lead            on public.agendamentos_adv(lead_id);

create index idx_adv_hours_advogado    on public.advogado_hours(advogado_id);
-- `whatsapp_lead` já tem índice pelo `unique`.


-- -----------------------------------------------------------------------------
-- FUSO DO ESCRITÓRIO
-- -----------------------------------------------------------------------------
create or replace function public.fuso_escritorio()
returns text
language sql
stable
as $$
  select coalesce((select fuso_horario from public.office_config where id = 1), 'America/Sao_Paulo');
$$;

-- `dia_semana` a partir do número do Postgres (0 = domingo).
create or replace function public.dia_semana_de(p_dow int)
returns dia_semana
language sql
immutable
as $$
  select (array['domingo','segunda','terca','quarta','quinta','sexta','sabado']::dia_semana[])[p_dow + 1];
$$;


-- -----------------------------------------------------------------------------
-- PASSO 4 — TRIGGERS
-- -----------------------------------------------------------------------------

-- Trigger 1 — Criar advogado_hours ao criar advogado (idêntico à especificação)
create or replace function public.criar_advogado_hours()
returns trigger
language plpgsql
as $$
begin
  insert into public.advogado_hours (advogado_id, dia) values
    (new.id, 'domingo'),
    (new.id, 'segunda'),
    (new.id, 'terca'),
    (new.id, 'quarta'),
    (new.id, 'quinta'),
    (new.id, 'sexta'),
    (new.id, 'sabado');
  return new;
end;
$$;

create trigger on_advogado_created
  after insert on public.advogados
  for each row execute function public.criar_advogado_hours();


-- Trigger 2 — Conversão bidirecional lead ↔ cliente
--
-- DESVIO DA ESPECIFICAÇÃO. A versão do documento tinha três defeitos:
--
-- a) Só disparava em `agendamentos_adv`. Mas o Kanban faz
--    `UPDATE leads_adv SET status = 'compareceu'` — e nada criava o cliente.
-- b) Na reversão gravava `leads_adv.status = NEW.status`, onde NEW.status é um
--    `agendamento_status` ('faltou', 'cancelado'...). Esses valores não existem
--    em `lead_status`: o UPDATE falharia com erro de tipo.
-- c) Mover de `compareceu` para `fechado` (contrato fechado, "cliente ativo")
--    apagaria o cliente.
--
-- A regra passa a ter UM dono: o status do lead.
--   • status em ('compareceu','fechado')       → existe em clientes_adv
--   • status fora disso                        → não existe
-- O agendamento só move o status do lead (trigger 3), e este trigger faz o resto.
create or replace function public.sincronizar_cliente()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_era_cliente boolean := old.status in ('compareceu', 'fechado');
  v_eh_cliente  boolean := new.status in ('compareceu', 'fechado');
  v_cliente     uuid;
begin
  if v_eh_cliente and not v_era_cliente then
    insert into public.clientes_adv (lead_id, data_primeira_visita)
    values (new.id, (now() at time zone public.fuso_escritorio())::date)
    on conflict (lead_id) do nothing;

    select id into v_cliente from public.clientes_adv where lead_id = new.id;
    update public.agendamentos_adv set cliente_id = v_cliente
     where lead_id = new.id and cliente_id is null;

  elsif v_era_cliente and not v_eh_cliente then
    delete from public.clientes_adv where lead_id = new.id;
  end if;
  return new;
end;
$$;

create trigger on_lead_status_cliente
  after update of status on public.leads_adv
  for each row
  when (old.status is distinct from new.status)
  execute function public.sincronizar_cliente();


-- Trigger 3 — O agendamento move o lead
--
-- • Marcou (agendado/confirmado)  → lead vai para `consulta_agendada`
-- • Compareceu                    → lead vai para `compareceu` (vira cliente)
-- • Saiu de compareceu            → lead volta (consulta_agendada se ainda está
--                                    marcado; perdido se faltou/cancelou)
-- • Cancelou ou faltou            → `perdido`, se não sobrou outra consulta
--                                    (é o que o n8n fazia ao cancelar)
--
-- Nunca rebaixa quem está `fechado`: contrato assinado não volta para o funil
-- porque uma consulta de retorno foi remarcada.
--
-- E mantém `data_agendamento` / `id_agendamento` apontando para a PRÓXIMA
-- consulta ativa — a "referência rápida" da especificação.
create or replace function public.agendamento_move_lead()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_lead      uuid := coalesce(new.lead_id, old.lead_id);
  v_status    lead_status;
  v_proxima   record;
  v_ativas    int;
  v_presencas int;
begin
  select status into v_status from public.leads_adv where id = v_lead;
  if v_status is null then
    return null;
  end if;

  select id, data_hora_inicio into v_proxima
    from public.agendamentos_adv
   where lead_id = v_lead
     and status in ('agendado', 'confirmado')
     and data_hora_inicio > now()
   order by data_hora_inicio
   limit 1;

  select count(*) into v_ativas
    from public.agendamentos_adv
   where lead_id = v_lead and status in ('agendado', 'confirmado');

  select count(*) into v_presencas
    from public.agendamentos_adv
   where lead_id = v_lead and status = 'compareceu';

  update public.leads_adv
     set data_agendamento = v_proxima.data_hora_inicio,
         id_agendamento   = v_proxima.id::text
   where id = v_lead;

  if v_status = 'fechado' then
    return null;
  end if;

  if tg_op <> 'DELETE' and new.status = 'compareceu' then
    update public.leads_adv set status = 'compareceu' where id = v_lead;

  -- Só desfaz a promoção quando ESTE agendamento saiu de compareceu. Um cliente
  -- promovido pelo Kanban não tem agendamento `compareceu`, e marcar o retorno
  -- dele não pode rebaixá-lo.
  elsif tg_op = 'UPDATE' and old.status = 'compareceu'
        and v_status = 'compareceu' and v_presencas = 0 then
    update public.leads_adv
       set status = case when v_ativas > 0 then 'consulta_agendada'::lead_status
                         else 'perdido'::lead_status end
     where id = v_lead;

  elsif v_status <> 'compareceu' and v_ativas > 0 then
    update public.leads_adv set status = 'consulta_agendada' where id = v_lead;

  elsif v_status = 'consulta_agendada' and v_ativas = 0 then
    update public.leads_adv set status = 'perdido' where id = v_lead;
  end if;

  return null;
end;
$$;

-- `update of status, data_hora_inicio, lead_id` e não `update` puro: o trigger 2
-- grava `cliente_id` aqui, e sem a lista de colunas isso dispararia este trigger
-- de novo, no meio da promoção.
create trigger on_agendamento_move_lead
  after insert or delete or update of status, data_hora_inicio, lead_id
  on public.agendamentos_adv
  for each row execute function public.agendamento_move_lead();


-- Trigger 4 — `updated_at` do office_config
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger office_config_updated_at
  before update on public.office_config
  for each row execute function public.set_updated_at();


-- -----------------------------------------------------------------------------
-- PASSO 5 — ROW LEVEL SECURITY
--
-- DESVIO DA ESPECIFICAÇÃO: a especificação do frontend diz "sem autenticação".
-- Decisão do escritório (20/10/2026): COM login. Os dados são de Direito de
-- Família — LGPD, dados sensíveis, menores — e a própria especificação do banco
-- já exigia usuário autenticado no RLS. Sem login, o RLS teria que abrir tudo
-- para o papel `anon`, cuja chave vai no JavaScript entregue a qualquer visitante.
--
-- Não há política de DELETE nas tabelas operacionais: a regra da especificação é
-- "nunca deletar, sempre atualizar status". A exclusão definitiva de uma pessoa
-- (direito ao esquecimento da LGPD) passa pela Edge Function `whatsapp`, rota
-- `/apagar-pessoa`, que confere se quem pede é admin.
-- -----------------------------------------------------------------------------
alter table public.usuarios          enable row level security;
alter table public.office_config     enable row level security;
alter table public.office_hours      enable row level security;
alter table public.advogados         enable row level security;
alter table public.advogado_hours    enable row level security;
alter table public.leads_adv         enable row level security;
alter table public.clientes_adv      enable row level security;
alter table public.agendamentos_adv  enable row level security;
alter table public.servicos_adv      enable row level security;

-- Operacionais: autenticado lê, cria e altera.
do $$
declare
  t text;
begin
  foreach t in array array[
    'leads_adv', 'clientes_adv', 'agendamentos_adv',
    'advogados', 'advogado_hours', 'servicos_adv'
  ] loop
    execute format(
      'create policy "autenticado_select" on public.%I for select to authenticated using (true)', t);
    execute format(
      'create policy "autenticado_insert" on public.%I for insert to authenticated with check (true)', t);
    execute format(
      'create policy "autenticado_update" on public.%I for update to authenticated using (true) with check (true)', t);
  end loop;
end $$;

-- Configuração do escritório: todos leem (a barra lateral mostra nome e logo);
-- só admin altera. Leitura aberta também ao `anon`: a tela de login mostra o
-- nome e a logo antes de existir sessão, e nada aqui é sigiloso — é o que o
-- escritório publica no próprio site.
create policy "publico_select" on public.office_config
  for select to anon, authenticated using (true);
create policy "somente_admin_config" on public.office_config
  for update to authenticated using (public.eh_admin()) with check (public.eh_admin());

create policy "autenticado_select" on public.office_hours
  for select to authenticated using (true);
create policy "somente_admin_hours" on public.office_hours
  for update to authenticated using (public.eh_admin()) with check (public.eh_admin());

-- Usuários: todos veem a equipe; cada um muda o próprio nome; papel só o admin.
create policy "autenticado_select" on public.usuarios
  for select to authenticated using (true);
create policy "proprio_ou_admin_update" on public.usuarios
  for update to authenticated
  using (id = auth.uid() or public.eh_admin())
  with check (
    public.eh_admin()
    or (id = auth.uid() and role = (select u.role from public.usuarios u where u.id = auth.uid()))
  );


-- -----------------------------------------------------------------------------
-- REALTIME — o Kanban e a Agenda andam sozinhos quando a secretária mexe
-- -----------------------------------------------------------------------------
alter publication supabase_realtime add table public.leads_adv;
alter publication supabase_realtime add table public.agendamentos_adv;


-- -----------------------------------------------------------------------------
-- STORAGE — logo e favicon (Configurações → Informações do Escritório)
--
-- Público para leitura: a logo aparece na tela de login, antes de existir sessão.
-- -----------------------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('escritorio', 'escritorio', true)
on conflict (id) do nothing;

create policy "escritorio_leitura" on storage.objects
  for select using (bucket_id = 'escritorio');
create policy "escritorio_admin_insert" on storage.objects
  for insert to authenticated with check (bucket_id = 'escritorio' and public.eh_admin());
create policy "escritorio_admin_update" on storage.objects
  for update to authenticated using (bucket_id = 'escritorio' and public.eh_admin());


-- -----------------------------------------------------------------------------
-- PASSO 6 — DADOS INICIAIS
-- -----------------------------------------------------------------------------
insert into public.office_config (nome) values ('Meu Escritório de Advocacia');

insert into public.office_hours (dia) values
  ('domingo'), ('segunda'), ('terca'), ('quarta'),
  ('quinta'), ('sexta'), ('sabado');

-- O trigger on_advogado_created cria as 7 linhas em advogado_hours.
insert into public.advogados (nome, cor) values ('Dr. Nome', '#1B3A5C');


-- -----------------------------------------------------------------------------
-- PASSO 7 — USUÁRIO ADMIN
--
-- DESVIO DA ESPECIFICAÇÃO: `UPDATE auth.config` e `auth.create_user()` não
-- existem no Supabase. O usuário é criado no painel:
--   Authentication → Users → Add user → "Auto Confirm User" marcado.
-- O primeiro usuário vira admin pelo trigger `handle_new_user`. Ver INSTALACAO.md.
-- -----------------------------------------------------------------------------
