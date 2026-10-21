# CLAUDE.md

Orientações para quem for trabalhar neste repositório, seja uma pessoa ou uma IA.

## ⚠️ Primeiro: isto é uma instalação nova?

Se **não existe `.env` na raiz** (ou ele está vazio), a pessoa quer **colocar o sistema no ar**, não mexer no código. Leia o [`INSTALACAO.md`](INSTALACAO.md) inteiro e conduza as sete partes na ordem, uma coisa de cada vez, em português simples. As partes marcadas 🤖 são suas; as 👤 são dela.

**Não desligue o modo teste da secretária.** Isso é decisão do escritório, não passo de instalação.

---

## O que é

Sistema de gestão para escritório de advocacia (Direito de Família e Sucessões na origem), com uma secretária de IA no WhatsApp. **Tudo em português do Brasil**: interface, tabelas, colunas, status, comentários e commits. Mantenha assim.

### De onde veio

1. **Especificação**: [`docs/especificacao/`](docs/especificacao/) tem os três prompts originais (banco, setup e frontend). As telas, o design system, os status e as tabelas seguem esses documentos.
2. **Arquitetura do agente**: veio do projeto "Odonto IA com CRM" (Edge Functions no lugar de n8n e Chatwoot). Os arquivos `_shared/whatsapp.ts`, `evolution.ts`, `uazapi.ts`, `llm.ts`, `tempo.ts` e `db.ts` são adaptações diretas de lá.
3. **Comportamento da secretária**: o fluxo de atendimento da "Camila" veio do workflow n8n original (fora do Git, em `legado/`).

### Desvios da especificação, e por quê

Cada um está comentado no código com `DESVIO DA ESPECIFICAÇÃO`.

| Especificação | Aqui | Motivo |
|---|---|---|
| Sem autenticação | Com login | Decisão do escritório (20/10/2026): dados sensíveis, LGPD |
| Campos Chatwoot em `leads_adv` | Removidos | O Chatwoot saiu; conversa em `mensagens_whatsapp` |
| `minutos_ultima_mensagem` GENERATED com `NOW()` | Calculado na leitura | O Postgres recusa coluna gerada não imutável |
| Política admin consulta `users` | Tabela `usuarios` | `users` não existia em nenhum passo |
| `auth.config` / `auth.create_user()` | Usuário criado no painel; o 1º vira admin | Essas funções não existem no Supabase |
| Trigger lead↔cliente só em agendamentos | Dono único: o status do lead | O Kanban não criava cliente; a reversão gravava tipo inválido |
| `lead_id` OU `cliente_id` | `lead_id` sempre | Todo cliente é lead; a consulta não some ao desfazer a promoção |
| 9 páginas | + Login, Conversas, Agenda | Substituem Chatwoot e Google Calendar |
| Configurações com 2 seções | + Advogados, Serviços, Secretária de IA | A especificação tinha advogados sem tela e o catálogo era o Sheets |

---

## Comandos

```bash
npm run dev / build / lint
npm run prompt                                    # depois de mexer em agente-ia/prompt.md
npx supabase db push                              # migrações
npx supabase functions deploy whatsapp --no-verify-jwt
npx supabase functions deploy follow-up --no-verify-jwt
npx -y deno@2 check supabase/functions/whatsapp/index.ts supabase/functions/follow-up/index.ts
```

**Testar o banco sem tocar em produção:** `npx supabase start` sobe tudo em Docker e aplica `supabase/migrations/`. As travas de agenda, a conversão lead↔cliente e o RLS foram validadas assim.

---

## Banco

- **Migrações numeradas e imutáveis.** Uma migração que já rodou em algum lugar não se edita: mudança nova é arquivo novo (`0007_...`).
- **Fuso:** toda conta de "que dia é" usa `fuso_escritorio()`. A sessão do PostgREST pode estar em UTC.
- **A regra mora no banco, não na tela.** Sobreposição de horário (exclusion constraint), jornada do advogado (trigger) e conversão lead↔cliente (trigger) valem para a tela e para a secretária. Não duplique essas regras no React; trate o erro que o banco devolve (`23P01` = horário ocupado, `fora_da_jornada`).
- **Cliente = lead com status `compareceu` ou `fechado`.** `clientes_adv` é mantida pelo trigger `sincronizar_cliente`. Nunca insira nela direto.
- **Sem DELETE** pela tela nas tabelas operacionais (regra 11 da especificação). A exclusão LGPD passa pela rota `/apagar-pessoa` da função `whatsapp` (só admin).
- `agenda_marcar/remarcar/cancelar` e `leads_para_follow_up` são **só da `service_role`**. Recebem `p_lead_id` e confiam nele.

## Frontend

- **Tailwind + tokens CSS.** Cores sempre por `var(--token)` (definidos em `src/index.css`, claro e escuro). Classes utilitárias de layout pelo Tailwind; peças repetidas em `@layer components` (`.card`, `.campo`, `.tabela`, `.rotulo`).
- **Datas sempre por `src/lib/datas.ts`** (fuso de São Paulo explícito). Nunca `getHours()` / `getDate()`. Filtro de período: início inclusivo, fim **exclusivo** (`intervalo()`).
- **Status:** nomes, descrições e cores em `src/lib/status.ts`, iguais às tabelas da especificação.
- **WhatsApp** canônico = só dígitos com DDI (`src/lib/telefone.ts`). Gravar diferente cria lead duplicado.
- **Ícones:** Lucide, `strokeWidth={1.5}`, tamanho 18.
- **Toda página:** `PageHeader` com o título e a descrição da especificação; carregando → `Carregando`; vazio → `Vazio`; ação → toast.
- **Contagens do Dashboard são do banco** (`dashboard_resumo`). As listas param em 1000 linhas (limite da API) e avisam.

## A secretária de IA

Ver [`agente-ia/README.md`](agente-ia/README.md). O essencial:

- O prompt é **`agente-ia/prompt.md`**. `prompt-oficial.ts` é gerado (`npm run prompt`); não edite o gerado.
- Os marcadores `{{...}}` do prompt são preenchidos em `_shared/prompt.ts` a cada mensagem, lendo o banco. Mexeu num nome, mexa nos dois.
- O catálogo de serviços entra como `enum` no schema das ferramentas: ela não consegue gravar serviço fora da lista.
- O modelo **não preenche** WhatsApp, id do lead nem uuid de advogado. Isso vem do contexto.
- Frases de falha de mídia (`não consegui abrir esta imagem`) são contrato entre `whatsapp/index.ts` e `prompt.md`.

## Regras

1. **A documentação faz parte da entrega.** Mudou a instalação: `INSTALACAO.md`. Mudou a secretária: `agente-ia/README.md`. Mudou uma regra do banco: comentário na migração.
2. **Nunca versione segredo.** `.env`, `supabase/functions/.env` e `legado/` estão no `.gitignore`.
3. **Commits em português**, no imperativo ou descritivos ("agenda: recusar horário fora da jornada").

## Débito conhecido

- Bundle de ~1 MB (Recharts e dnd-kit no pacote principal). Dá para dividir com `import()` por rota.
- A rota `/instance/disconnect` da uazapi não foi testada contra servidor real (herdado do projeto de origem).
- Não há testes automatizados. As regras de banco foram validadas manualmente num Supabase local.
