# A secretária de IA

Atende o WhatsApp do escritório: acolhe, entende o caso, explica a consulta e marca o horário. Substitui os workflows do n8n "Secretaria", "sobreEscritorio", "CRM", "Agendamento" e "Follow UP", e também o Chatwoot.

**Ligar, desligar, trocar o modelo, o nome, a ponte de WhatsApp e o modo teste: Configurações → Secretária de IA.** O prompt aparece lá só para leitura. Quem edita é o desenvolvedor, neste diretório.

---

## Onde fica cada coisa

**Nesta pasta**

| Arquivo | O que é |
|---|---|
| `prompt.md` | ⭐ Quem ela é e como se comporta. **É o único lugar onde se edita o prompt.** |
| `gerar-prompt.mjs` | `npm run prompt`: copia o `.md` para `supabase/functions/_shared/prompt-oficial.ts` |

**No servidor** (`supabase/functions/`)

| Arquivo | O que é |
|---|---|
| `whatsapp/index.ts` | Recebe o webhook, espera, pensa, responde. Também atende as rotas da tela (enviar, conexão, apagar pessoa) |
| `follow-up/index.ts` | Chamada pelo `pg_cron` a cada 10 min; escreve e envia os follow-ups |
| `_shared/prompt.ts` | Preenche os `{{marcadores}}` do prompt lendo o banco |
| `_shared/ferramentas.ts` | As 7 ferramentas (agenda, ficha, serviço) |
| `_shared/llm.ts` | OpenAI e Anthropic atrás de uma porta só; transcrição e descrição de imagem |
| `_shared/whatsapp.ts`, `evolution.ts`, `uazapi.ts`, `pontes.ts` | As duas pontes de WhatsApp e a porta comum |
| `_shared/db.ts`, `tempo.ts` | PostgREST por `fetch`; conversão de hora local para instante |

**No banco**: `0002_secretaria_ia.sql` (mensagens, configuração, modo teste), `0003_agenda.sql` (as funções que ela chama), `0004_follow_up.sql`.

---

## Uma mensagem, do começo ao fim

1. A ponte (Evolution ou uazapi) chama `POST /functions/v1/whatsapp` com o segredo.
2. A função acha ou cria o lead **sem nome** (o nome do perfil do WhatsApp não é usado), grava a mensagem e responde 200 na hora.
3. Áudio vira texto (Whisper); imagem vira uma descrição de duas frases. O arquivo vai para o bucket privado `midias-whatsapp`.
4. **Espera 12 s.** Se chegou outra mensagem do mesmo número, esta execução desiste e a mais nova responde por todas. O "digitando…" acende aos 8 s.
5. **Duas travas**: a equipe assumiu a conversa (`agente_pausado`)? A secretária está desligada, ou em modo teste com um número fora da lista? Então não responde (a mensagem continua em Conversas).
6. Monta o prompt (escritório, serviços, advogados e jornadas, data de hoje, ficha da pessoa) e conversa com o modelo, com até 6 idas e voltas de ferramenta.
7. Quebra a resposta em até 4 mensagens, com pausa proporcional ao tamanho, e envia.
8. Lead em `novo_contato` passa para `conversando`.

## As ferramentas

| Ferramenta | Faz |
|---|---|
| `ver_horarios_livres` | `agenda_horarios_disponiveis`; sem vaga no dia, devolve a próxima |
| `marcar_consulta` | `agenda_marcar`: escolhe advogado livre, recusa sobreposição, jornada, serviço fora do catálogo e segunda consulta futura |
| `ver_minhas_consultas` | As consultas futuras deste lead |
| `remarcar_consulta` / `cancelar_consulta` | Sem id quando há uma consulta só (o modelo não lembra resultado de ferramenta entre mensagens) |
| `sobre_o_servico` | A descrição completa do serviço (era a ferramenta `sobreEscritorio` + Google Sheets) |
| `atualizar_ficha` | Nome, `motivo_contato` (sempre do catálogo) e resumo em texto corrido |

## Follow-up

O `pg_cron` chama a função `follow-up` a cada 10 min. Quem recebe é decidido por `leads_para_follow_up()`:

- status `novo_contato`, `conversando` ou `follow_up`; conversa não assumida; sem consulta futura; passa no modo teste;
- a **última mensagem da conversa é nossa** (é o lead que está devendo resposta);
- 1º aos **20 min** de silêncio; 2º às **24 h** (e 12 h depois do 1º); 3º às **36 h** (e 6 h depois do 2º);
- só das **8h às 20h59** no fuso do escritório.

O lead vai para `follow_up`. Quando responde, volta para `conversando` e o ciclo recomeça.

## Mexer no prompt

1. Edite `prompt.md`.
2. `npm run prompt`
3. `npx supabase functions deploy whatsapp --no-verify-jwt`

Os marcadores (`{{NOME_AGENTE}}`, `{{NOME_ESCRITORIO}}`, `{{INFORMACOES_ESCRITORIO}}`, `{{SERVICOS}}`, `{{ADVOGADOS}}`, `{{DATA_HOJE}}`, `{{FICHA_DO_CLIENTE}}`) são preenchidos em `_shared/prompt.ts`. Marcador que não existir lá vai cru para o modelo.

**A ordem do prompt importa**: o que é igual para todos vem primeiro, e a data e a ficha por último. É o que aproveita o cache de prompt da OpenAI e da Anthropic.
