# Prompt — Banco de Dados
## Sistema de Gestão — Escritório de Advocacia

Você vai criar o banco de dados completo de um sistema de gestão para um escritório de advocacia. Você tem acesso ao Supabase via MCP. Execute os passos **na ordem exata** abaixo.

---

## PASSO 0 — TIMEZONE

```sql
ALTER DATABASE postgres SET timezone TO 'America/Sao_Paulo';
```

---

## PASSO 1 — ENUMs

```sql
CREATE TYPE lead_status AS ENUM (
  'novo_contato',
  'conversando',
  'consulta_agendada',
  'compareceu',
  'follow_up',
  'fechado',
  'perdido'
);

CREATE TYPE agendamento_status AS ENUM (
  'agendado',
  'confirmado',
  'compareceu',
  'faltou',
  'cancelado'
);

CREATE TYPE dia_semana AS ENUM (
  'domingo',
  'segunda',
  'terca',
  'quarta',
  'quinta',
  'sexta',
  'sabado'
);
```

---

## PASSO 2 — TABELAS

Execute na ordem abaixo para respeitar as dependências entre tabelas.

### Tabela: office_config

Configurações globais do escritório. Sempre terá apenas uma linha (id = 1). Nome e logo refletem em toda a UI automaticamente.

```sql
CREATE TABLE office_config (
  id          INT PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  nome        TEXT NOT NULL,
  logo_url    TEXT,
  favicon_url TEXT,
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

---

### Tabela: office_hours

Horário de funcionamento do escritório. Uma linha por dia da semana (7 linhas fixas). Reflete automaticamente no gráfico de atendimentos dentro/fora do horário comercial no dashboard.

```sql
CREATE TABLE office_hours (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  dia         dia_semana NOT NULL UNIQUE,
  aberto      BOOLEAN NOT NULL DEFAULT false,
  hora_inicio TIME,
  hora_fim    TIME,
  CONSTRAINT check_horas CHECK (
    (aberto = false) OR (hora_inicio IS NOT NULL AND hora_fim IS NOT NULL)
  )
);
```

---

### Tabela: advogados

Cada advogado tem sua própria agenda com cor identificadora. Ao criar um advogado, o trigger cria automaticamente 7 linhas em advogado_hours.

```sql
CREATE TABLE advogados (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome       TEXT NOT NULL,
  cor        TEXT NOT NULL DEFAULT '#1B3A5C',
  ativo      BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

---

### Tabela: advogado_hours

Horário de atendimento de cada advogado por dia da semana. Criada automaticamente via trigger ao criar um advogado. Cada dia pode ter horário independente.

```sql
CREATE TABLE advogado_hours (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  advogado_id UUID NOT NULL REFERENCES advogados(id) ON DELETE CASCADE,
  dia         dia_semana NOT NULL,
  aberto      BOOLEAN NOT NULL DEFAULT false,
  hora_inicio TIME,
  hora_fim    TIME,
  UNIQUE (advogado_id, dia),
  CONSTRAINT check_horas_advogado CHECK (
    (aberto = false) OR (hora_inicio IS NOT NULL AND hora_fim IS NOT NULL)
  )
);
```

---

### Tabela: leads_adv

Tabela central do sistema. Todos os contatos captados pelo agente de IA ou inseridos manualmente. É a origem de tudo — clientes e agendamentos referenciam esta tabela.

> **Campos Chatwoot** (`id_conta_chatwoot`, `id_conversa_chatwoot`, `id_lead_chatwoot`, `inbox_id_chatwoot`): salvos no banco mas **nunca exibidos no sistema**. Usados exclusivamente nas automações N8N.

> **`minutos_ultima_mensagem`**: coluna GENERATED que calcula em tempo real os minutos desde `ultima_mensagem`. Usada nas automações de follow up.

> **Colunas de follow up** (`follow_up_1`, `follow_up_2`, `follow_up_3`): preenchidas pelo agente de IA com a data/hora de quando cada follow up foi executado.

```sql
CREATE TABLE leads_adv (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome_lead               TEXT,
  whatsapp_lead           TEXT NOT NULL,
  motivo_contato          TEXT,
  resumo_conversa         TEXT,
  status                  lead_status NOT NULL DEFAULT 'novo_contato',
  inicio_atendimento      TIMESTAMPTZ,
  ultima_mensagem         TIMESTAMPTZ,

  -- Coluna gerada: calculada em tempo real pelo banco
  minutos_ultima_mensagem NUMERIC GENERATED ALWAYS AS (
    EXTRACT(EPOCH FROM (NOW() - ultima_mensagem)) / 60
  ) STORED,

  -- Campos Chatwoot (ocultos no sistema, usados no N8N)
  id_conta_chatwoot       TEXT,
  id_conversa_chatwoot    TEXT,
  id_lead_chatwoot        TEXT,
  inbox_id_chatwoot       TEXT,

  -- Follow ups (preenchidos pelo agente ao executar cada follow up)
  follow_up_1             TIMESTAMPTZ,
  follow_up_2             TIMESTAMPTZ,
  follow_up_3             TIMESTAMPTZ,

  -- Agendamento (referência rápida para automações N8N)
  data_agendamento        TIMESTAMPTZ,
  id_agendamento          TEXT,

  -- Anotações manuais do usuário
  anotacoes               TEXT,

  created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

---

### Tabela: clientes_adv

Criada automaticamente via trigger quando um agendamento é marcado como `compareceu`. O lead original permanece em `leads_adv` — a promoção é lógica, não física. A promoção é reversível.

**Regra de filtragem visual no sistema:**

- Aba Leads → `SELECT * FROM leads_adv WHERE id NOT IN (SELECT lead_id FROM clientes_adv)`
- Aba Clientes → `SELECT * FROM clientes_adv JOIN leads_adv ON clientes_adv.lead_id = leads_adv.id`

```sql
CREATE TABLE clientes_adv (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id              UUID NOT NULL UNIQUE REFERENCES leads_adv(id),
  data_primeira_visita DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

---

### Tabela: agendamentos_adv

Cada consulta marcada no sistema. Vincula advogado e lead ou cliente. Ao marcar como `compareceu`, o trigger converte o lead em cliente automaticamente.

> **Regra:** `lead_id` OU `cliente_id` — pelo menos um deve estar preenchido.

```sql
CREATE TABLE agendamentos_adv (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  advogado_id      UUID NOT NULL REFERENCES advogados(id),
  lead_id          UUID REFERENCES leads_adv(id),
  cliente_id       UUID REFERENCES clientes_adv(id),
  data_hora_inicio TIMESTAMPTZ NOT NULL,
  data_hora_fim    TIMESTAMPTZ NOT NULL,
  status           agendamento_status NOT NULL DEFAULT 'agendado',
  observacoes      TEXT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT check_lead_ou_cliente CHECK (
    lead_id IS NOT NULL OR cliente_id IS NOT NULL
  )
);
```

---

## PASSO 3 — ÍNDICES

```sql
-- leads_adv
CREATE INDEX idx_leads_adv_status      ON leads_adv(status);
CREATE INDEX idx_leads_adv_whatsapp    ON leads_adv(whatsapp_lead);
CREATE INDEX idx_leads_adv_inicio      ON leads_adv(inicio_atendimento);
CREATE INDEX idx_leads_adv_ultima_msg  ON leads_adv(ultima_mensagem);

-- agendamentos_adv
CREATE INDEX idx_agend_advogado        ON agendamentos_adv(advogado_id);
CREATE INDEX idx_agend_inicio          ON agendamentos_adv(data_hora_inicio);
CREATE INDEX idx_agend_status          ON agendamentos_adv(status);
CREATE INDEX idx_agend_lead            ON agendamentos_adv(lead_id);

-- advogado_hours
CREATE INDEX idx_adv_hours_advogado    ON advogado_hours(advogado_id);
```

---

## PASSO 4 — TRIGGERS

### Trigger 1 — Criar advogado_hours ao criar advogado

Ao inserir um novo advogado, criar automaticamente 7 linhas em `advogado_hours` (uma por dia da semana) com `aberto = false` por padrão. O admin configura os horários depois.

```sql
CREATE OR REPLACE FUNCTION criar_advogado_hours()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO advogado_hours (advogado_id, dia) VALUES
    (NEW.id, 'domingo'),
    (NEW.id, 'segunda'),
    (NEW.id, 'terca'),
    (NEW.id, 'quarta'),
    (NEW.id, 'quinta'),
    (NEW.id, 'sexta'),
    (NEW.id, 'sabado');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER on_advogado_created
  AFTER INSERT ON advogados
  FOR EACH ROW EXECUTE FUNCTION criar_advogado_hours();
```

---

### Trigger 2 — Conversão bidirecional lead ↔ cliente

Este trigger é **bidirecional**:

- Ao marcar agendamento como `compareceu` → cria o cliente automaticamente
- Ao sair de `compareceu` → deleta o cliente automaticamente

```sql
CREATE OR REPLACE FUNCTION converter_lead_em_cliente()
RETURNS TRIGGER AS $$
BEGIN

  -- PROMOÇÃO: status mudou PARA compareceu
  IF NEW.status = 'compareceu' AND OLD.status != 'compareceu' THEN
    IF NEW.lead_id IS NOT NULL THEN

      INSERT INTO clientes_adv (lead_id, data_primeira_visita)
      VALUES (NEW.lead_id, CURRENT_DATE)
      ON CONFLICT (lead_id) DO NOTHING;

      UPDATE leads_adv SET status = 'compareceu'
      WHERE id = NEW.lead_id;

    END IF;
  END IF;

  -- REVERSÃO: status saiu DE compareceu para qualquer outro
  IF OLD.status = 'compareceu' AND NEW.status != 'compareceu' THEN
    IF NEW.lead_id IS NOT NULL THEN

      DELETE FROM clientes_adv WHERE lead_id = NEW.lead_id;

      UPDATE leads_adv SET status = NEW.status
      WHERE id = NEW.lead_id;

    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER on_agendamento_compareceu
  AFTER UPDATE ON agendamentos_adv
  FOR EACH ROW EXECUTE FUNCTION converter_lead_em_cliente();
```

---

## PASSO 5 — ROW LEVEL SECURITY (RLS)

```sql
-- Ativar RLS em todas as tabelas
ALTER TABLE office_config     ENABLE ROW LEVEL SECURITY;
ALTER TABLE office_hours      ENABLE ROW LEVEL SECURITY;
ALTER TABLE advogados         ENABLE ROW LEVEL SECURITY;
ALTER TABLE advogado_hours    ENABLE ROW LEVEL SECURITY;
ALTER TABLE leads_adv         ENABLE ROW LEVEL SECURITY;
ALTER TABLE clientes_adv      ENABLE ROW LEVEL SECURITY;
ALTER TABLE agendamentos_adv  ENABLE ROW LEVEL SECURITY;

-- Usuários autenticados: leitura e escrita nas tabelas operacionais
CREATE POLICY "autenticado_select" ON leads_adv
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "autenticado_insert" ON leads_adv
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "autenticado_update" ON leads_adv
  FOR UPDATE USING (auth.role() = 'authenticated');

-- Repetir as 3 políticas acima para:
-- clientes_adv, agendamentos_adv, advogados, advogado_hours

-- Somente admin: office_config e office_hours
CREATE POLICY "somente_admin_config" ON office_config
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid() AND users.role = 'admin'
    )
  );

-- Repetir política admin para: office_hours
```

---

## PASSO 6 — DADOS INICIAIS

```sql
-- Configuração inicial do escritório
INSERT INTO office_config (nome)
VALUES ('Meu Escritório de Advocacia');

-- Horários do escritório (todos fechados por padrão — admin configura depois)
INSERT INTO office_hours (dia) VALUES
  ('domingo'), ('segunda'), ('terca'), ('quarta'),
  ('quinta'), ('sexta'), ('sabado');

-- Advogado padrão (pode ser editado ou substituído pelo admin)
-- O trigger on_advogado_created cria as 7 linhas em advogado_hours automaticamente
INSERT INTO advogados (nome, cor)
VALUES ('Dr. Nome', '#1B3A5C');
```

---

## PASSO 7 — USUÁRIO ADMIN

Execute este passo por último, após todos os dados iniciais estarem criados.

Primeiro, desabilite a confirmação de e-mail no Supabase:

```sql
UPDATE auth.config
SET confirm_email = false
WHERE id = 1;
```

Em seguida, crie o usuário administrador:

```sql
-- Criar usuário admin
SELECT auth.create_user(
  '{"email": "COLOQUE-SEU-EMAIL", "password": "COLOQUE-SENHA-FORTE", "email_confirm": true}'::jsonb
);

-- Promover para admin
UPDATE users
SET role = 'admin'
WHERE id = (
  SELECT id FROM auth.users WHERE email = 'COLOQUE-SEU-EMAIL'
);
```

> **Importante:** troque `COLOQUE-SEU-EMAIL` e `COLOQUE-SENHA-FORTE` pelas credenciais reais antes de executar.

---

## RESUMO DAS 7 TABELAS

| # | Tabela | Descrição |
|---|---|---|
| 1 | `office_config` | Nome, logo e favicon do escritório (1 linha) |
| 2 | `office_hours` | Horário de funcionamento por dia (7 linhas) |
| 3 | `advogados` | Advogados com agenda e cor identificadora |
| 4 | `advogado_hours` | Horário de atendimento de cada advogado por dia |
| 5 | `leads_adv` | Todos os contatos — tabela central do sistema |
| 6 | `clientes_adv` | Criado automaticamente ao marcar Compareceu |
| 7 | `agendamentos_adv` | Consultas vinculadas a advogado + lead/cliente |

---

## NOTAS PARA O FRONTEND

- **Kanban bidirecional:** ao arrastar qualquer card, executar `UPDATE leads_adv SET status = 'novo_status' WHERE id = lead_id`. Ao mover para `compareceu`, exibir modal de confirmação antes de executar. O trigger cria o cliente. Ao sair de `compareceu`, o trigger deleta o cliente.
- **Campos Chatwoot:** nunca renderizar `id_conta_chatwoot`, `id_conversa_chatwoot`, `id_lead_chatwoot` e `inbox_id_chatwoot` em nenhuma tela, modal ou listagem.
- **Filtro leads:** `WHERE id NOT IN (SELECT lead_id FROM clientes_adv)`
- **Filtro clientes:** `JOIN clientes_adv ON clientes_adv.lead_id = leads_adv.id`
- **Dashboard:** comparar `data_hora_inicio` dos agendamentos com `office_hours` para classificar dentro/fora do horário comercial em tempo real.
- **Timezone:** sempre `America/Sao_Paulo` em todas as queries e exibições de data.
