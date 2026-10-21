# Sistema de Gestão — Escritório de Advocacia

Sistema web para escritórios de advocacia, com uma **secretária de IA que atende pelo WhatsApp**: ela acolhe o cliente, entende o caso, explica a consulta e marca o horário com o advogado. A equipe acompanha tudo no sistema: o funil de leads, as conversas, a agenda, os clientes e os follow-ups.

**Tudo num lugar só.** A primeira versão rodava em seis ferramentas externas. Agora é um app React e um projeto Supabase:

| Antes | Agora |
|---|---|
| n8n (5 workflows do agente) | Edge Function `whatsapp` |
| Chatwoot | Tela **Conversas** |
| Google Calendar | Tela **Agenda** + regras de agenda no banco |
| Google Sheets (catálogo) | Tabela `servicos_adv`, editada em Configurações |
| n8n (3 workflows de follow-up) | Edge Function `follow-up` + `pg_cron` |
| Redis, memória Postgres do n8n | `mensagens_whatsapp` + ficha do lead |

O WhatsApp continua chegando por uma ponte externa, **Evolution API** ou **uazapi**, escolhida na tela. O Supabase não fala com o WhatsApp sozinho.

> # 👉 Para instalar: [`INSTALACAO.md`](INSTALACAO.md)

---

## O que o sistema faz

| Tela | O que tem |
|---|---|
| **Dashboard** | Leads, clientes e consultas do dia; volume por dia; por dia da semana; atendimentos dentro e fora do horário comercial |
| **Kanban** | O funil em 7 etapas, com arrastar e soltar. Atualiza sozinho quando a secretária move um lead |
| **Conversas** | O WhatsApp do escritório: lê o que a secretária conversou, **assume a conversa** e responde pelo mesmo número |
| **Leads / Clientes** | Quem ainda não veio à consulta e quem já veio, com filtro por período |
| **Ficha** | Dados, resumo da conversa escrito pela secretária, consultas, anotações e exclusão de dados pessoais (LGPD) |
| **Follow Up** | Leads que pararam de responder. A secretária retoma a conversa em 20 min, 24 h e 36 h |
| **Agenda** | Calendário semanal e mensal de todos os advogados, cada um na sua cor. Clique no horário vazio para marcar |
| **Agendamentos** | Lista das consultas, com troca rápida de status. "Compareceu" promove o lead a cliente |
| **Configurações** | Escritório, horário, advogados e jornadas, serviços, e a secretária de IA (liga/desliga, modelo, modo teste, conexão do WhatsApp) |

### A secretária de IA

- **Uma resposta por vez**: espera o cliente terminar de escrever (12 s) e responde em 2 ou 3 mensagens curtas, com "digitando…".
- **Entende áudio** (transcrição) **e imagem** (descrição), sem nunca opinar juridicamente sobre o conteúdo.
- **Marca, remarca e cancela** na agenda real. O horário que ela oferece é o mesmo que a tela mostra, e o banco recusa sobreposição e horário fora da jornada.
- **Escreve a ficha** do lead: nome, assunto (sempre um serviço do catálogo) e um resumo em texto corrido para o advogado.
- **Não dá orientação jurídica, não promete resultado, não fala de honorários.** Passa para a equipe em caso de violência doméstica, prazo judicial ou pedido de falar com uma pessoa.
- **Modo teste**: até o escritório decidir, ela só responde aos números da lista.

O prompt fica em [`agente-ia/prompt.md`](agente-ia/prompt.md), e o funcionamento está descrito em [`agente-ia/README.md`](agente-ia/README.md).

---

## Tecnologias

| Camada | Tecnologia |
|---|---|
| Interface | React 19 + TypeScript, Vite 8, React Router 7 |
| Estilo | Tailwind CSS 3, com os tokens do design system em CSS (claro e escuro) |
| Gráficos / Kanban | Recharts / dnd-kit |
| Banco, login, arquivos, tempo real | Supabase (PostgreSQL 17, Auth, Storage, Realtime) |
| Secretária e follow-up | Supabase Edge Functions (Deno) + `pg_cron` |
| IA | OpenAI (padrão `gpt-4.1-mini`, Whisper para áudio). Claude opcional |

## Estrutura

```
├── src/
│   ├── pages/            uma por rota (Dashboard, Kanban, Conversas, Agenda…)
│   ├── components/       ui/ (design system), layout/, configuracoes/
│   ├── contexts/         tema, login, toasts, dados do escritório
│   └── lib/              supabase, datas (fuso de São Paulo), status, telefone
├── supabase/
│   ├── migrations/       0001 schema · 0002 secretária · 0003 agenda · 0004 follow-up · 0005 serviços · 0006 dashboard
│   └── functions/        whatsapp/ · follow-up/ · _shared/ (IA, pontes de WhatsApp, ferramentas, prompt)
├── agente-ia/            prompt.md (o que a secretária é) e o gerador do prompt embutido
├── docs/especificacao/   os três documentos de especificação originais
├── INSTALACAO.md         do zero até a secretária atendendo
└── CLAUDE.md             orientações para quem (pessoa ou IA) for mexer no código
```

## Comandos

```bash
npm run dev       # servidor de desenvolvimento (http://localhost:5173)
npm run build     # TypeScript + build de produção
npm run lint      # ESLint
npm run prompt    # agente-ia/prompt.md → supabase/functions/_shared/prompt-oficial.ts
```

## Segurança

- **Com login.** Os dados são de Direito de Família (LGPD, dados sensíveis, menores). O RLS libera o banco só para usuários autenticados, e o **cadastro público fica desligado** (INSTALACAO.md, 4.1).
- **As chaves de WhatsApp e de IA nunca chegam ao navegador.** Tudo que fala com elas passa pela Edge Function, que confere a sessão.
- **Marcar, remarcar e cancelar pelo WhatsApp** são funções SQL que só a Edge Function executa (`service_role`).
- **Excluir os dados de uma pessoa** (ficha, conversa, arquivos e consultas) é exclusivo do administrador, pela ficha.
