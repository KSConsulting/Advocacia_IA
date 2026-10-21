# Instalação — do zero até a secretária atendendo

Este guia é o **único** caminho de instalação. Se outro documento discordar dele, vale este.

São sete partes. Cada uma diz **quem faz**:

- 👤 **você**: criar contas, colar chaves, clicar em painéis de terceiros;
- 🤖 **a IA da sua IDE** (Claude Code, Codex, Cursor...): rodar os comandos. Se preferir, você roda à mão; os comandos estão todos aqui.

> **Usando uma IDE com IA?** Abra a pasta do projeto e peça:
>
> ```
> Leia o INSTALACAO.md e me guie pela instalação, do começo.
> ```

---

## Parte 0 — 👤 O que precisa estar na máquina

- **Node.js 20.19+ ou 22.12+** (`node -v`). É a exigência do Vite 8.
- **Git**.
- O Supabase CLI **não** precisa ser instalado: os comandos usam `npx supabase`.

```bash
git clone <URL-DO-REPOSITÓRIO>
cd <pasta>
npm install
```

---

## Parte 1 — 👤 As contas

### 1.1. Supabase (o banco, o login e o servidor da secretária)

1. Crie um projeto em [supabase.com](https://supabase.com) (região **São Paulo**).
2. Anote, em **Project Settings → API**:
   - **Project URL** (`https://SEU_REF.supabase.co`). O `SEU_REF` é o código do projeto;
   - a chave **`anon` / `public`**.

### 1.2. OpenAI

Crie uma chave em [platform.openai.com/api-keys](https://platform.openai.com/api-keys). Ela é usada para a conversa, para transcrever áudios e para ler imagens.

> A chave da Anthropic é **opcional**: só se for usar um modelo Claude na secretária.

### 1.3. Uma ponte de WhatsApp (só uma)

O Supabase não fala com o WhatsApp sozinho. Escolha **uma**:

| Ponte | O que é | O que anotar |
|---|---|---|
| **Evolution API v2** | Servidor próprio (EasyPanel, VPS) | URL do servidor, API key, nome da instância |
| **uazapi v2** | Serviço pago e gerenciado | URL do servidor, **token da instância** |

### 1.4. Invente dois segredos

Dois textos longos e aleatórios, por exemplo:

```bash
node -e "console.log(require('crypto').randomBytes(24).toString('hex'))"
```

- `WEBHOOK_SEGREDO`: protege o endereço que recebe as mensagens do WhatsApp;
- `FOLLOW_UP_SEGREDO`: protege o disparo automático dos follow-ups.

---

## Parte 2 — 👤 Os dois arquivos de chaves

```bash
cp .env.example .env
cp supabase/functions/.env.example supabase/functions/.env
```

- **`.env`**: a URL e a chave `anon` do Supabase (Parte 1.1).
- **`supabase/functions/.env`**: OpenAI, os dois segredos e **uma** ponte de WhatsApp.

Os dois estão no `.gitignore` e nunca sobem para o GitHub.

---

## Parte 3 — 🤖 O banco e as funções

```bash
# 1. Entrar na conta do Supabase (abre o navegador) e ligar a pasta ao projeto
npx supabase login
npx supabase link --project-ref SEU_REF

# 2. Criar o banco: as 6 migrações de supabase/migrations/
npx supabase db push

# 3. Embutir o prompt da secretária na função (agente-ia/prompt.md → .ts)
npm run prompt

# 4. Publicar as duas Edge Functions
npx supabase functions deploy whatsapp --no-verify-jwt
npx supabase functions deploy follow-up --no-verify-jwt

# 5. Subir as chaves das funções
npx supabase secrets set --env-file supabase/functions/.env
```

> **`--no-verify-jwt` não é opcional.** Quem chama a função `whatsapp` é a ponte, e quem chama a `follow-up` é o banco. Nenhum dos dois tem sessão de usuário. Sem a flag, o Supabase responde 401 antes do código rodar e as mensagens somem sem erro visível. As duas funções conferem os próprios segredos.

**6. O endereço e o segredo do follow-up, no Vault.** No **SQL Editor** do Supabase:

```sql
select vault.create_secret('https://SEU_REF.supabase.co', 'projeto_url');
select vault.create_secret('O MESMO VALOR DE FOLLOW_UP_SEGREDO', 'follow_up_segredo');
```

O `pg_cron` chama a função `follow-up` a cada 10 minutos. Sem estes dois segredos, ele não chama nada e registra o motivo no log do Postgres.

### Conferir

```sql
select count(*) from servicos_adv;   -- 19
select * from cron.job;              -- follow-up-secretaria, */10 * * * *
```

---

## Parte 4 — 👤 Os cliques que a IA não alcança

### 4.1. Fechar o cadastro público (⚠️ obrigatório)

**Authentication → Sign In / Providers → desligue "Allow new users to sign up".**

O sistema dá acesso completo a qualquer usuário logado. Com o cadastro aberto, qualquer pessoa que tenha a chave `anon` (que fica visível no site) cria uma conta e lê todos os casos.

### 4.2. O primeiro usuário

**Authentication → Users → Add user → Create new user**, com **Auto Confirm User** marcado.

**O primeiro usuário criado vira administrador.** Os seguintes entram como equipe: usam tudo, mas não alteram as informações do escritório, o horário nem a secretária.

### 4.3. Apontar o webhook do WhatsApp

Sem isso, o WhatsApp conecta, a tela mostra "Conectado" e **nenhuma mensagem chega**.

**Evolution API**: no painel, a instância → Webhook:

| Campo | Valor |
|---|---|
| URL | `https://SEU_REF.supabase.co/functions/v1/whatsapp` |
| Headers | `x-webhook-segredo: <WEBHOOK_SEGREDO>` |
| Webhook by events | desligado |
| Base64 | **desligado** |
| Eventos | `MESSAGES_UPSERT` |

**uazapi**: Webhook da instância:

| Campo | Valor |
|---|---|
| URL | `https://SEU_REF.supabase.co/functions/v1/whatsapp?segredo=<WEBHOOK_SEGREDO>` |
| Eventos | `messages` |
| Excluir | mensagens enviadas pela API (`wasSentByApi`) |

A uazapi não aceita cabeçalho próprio, por isso o segredo vai na URL.

**Só a ponte escolhida** pode apontar para a função. Se você trocar de ponte, desligue o webhook da antiga.

---

## Parte 5 — 👤 A cara do seu escritório

Rode `npm run dev`, abra `http://localhost:5173` e entre com o usuário da Parte 4.2. Em **Configurações**:

1. **Escritório**: nome, logo, endereço, Instagram, site, áreas de atuação, duração da consulta, se a primeira é gratuita e a sala padrão de videoconferência. **A secretária só fala do escritório o que estiver aqui.**
2. **Horário**: o horário de funcionamento. Ele aparece no Dashboard e é o que a secretária informa.
3. **Advogados**: troque o "Dr. Nome" de exemplo, ajuste a cor e **configure a jornada de cada um**. A agenda só aceita consultas dentro dela. Para consultas online, cadastre a sala de videoconferência do advogado.
4. **Serviços**: ⚠️ **o passo que mais se esquece.** O banco nasce com os 19 serviços de Direito de Família e Sucessões do escritório de origem. A secretária oferece **exatamente** esta lista. Desative o que o seu escritório não faz e cadastre o que falta.

---

## Parte 6 — 👤 Testar e publicar

### 6.1. Teste com o seu número

Em **Configurações → Secretária de IA**:

1. **Conectar celular**: use o código de 8 dígitos ou o QR code no WhatsApp do escritório.
2. Confira se aparece **Conectado**, sem aviso de webhook.
3. **Modo teste** ligado (já vem assim) e o **seu** número na lista.
4. **Ligar secretária**.

Mande uma mensagem do seu celular para o WhatsApp do escritório. Em uns 15 segundos a secretária responde, e a conversa aparece em **Conversas**. Marque uma consulta e confira se ela aparece na **Agenda**.

### 6.2. Publicar na Vercel

1. Importe o repositório em [vercel.com/new](https://vercel.com/new).
2. Em **Environment Variables**, as duas do `.env`: `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY`.
3. Deploy. O `vercel.json` já cuida das rotas.
4. No Supabase, **Authentication → URL Configuration → Site URL**: o endereço da Vercel.

---

## Parte 7 — 👤 Colocar na frente dos clientes

Quando o escritório estiver satisfeito com os testes: **Configurações → Secretária de IA → desmarque Modo teste → Salvar.**

É esse ato que coloca a secretária para atender todos os contatos. Ele é uma decisão do escritório, não um passo técnico.

---

## Deu errado?

| Sintoma | Causa provável |
|---|---|
| Tela branca ao abrir o sistema | `.env` vazio ou com nome errado. O Vite embute no build: preencha e rode de novo. |
| "Conectado", mas nada chega em Conversas | Webhook não apontado, apontado para a ponte errada, ou segredo diferente (Parte 4.3). |
| A mensagem chega em Conversas, mas ninguém responde | Secretária desligada, modo teste com o número fora da lista, ou conversa assumida pela equipe. |
| Resposta nunca chega e o log da função mostra 401 | Função publicada sem `--no-verify-jwt`. Publique de novo (Parte 3). |
| A secretária diz que não tem horário | Jornada do advogado não configurada (Configurações → Advogados). |
| Follow-up nunca sai | Faltam os dois segredos no Vault (Parte 3, passo 6), ou o follow-up está desligado na tela. |
| "Faltam as chaves desta ponte" | `supabase/functions/.env` sem a ponte escolhida, ou o `secrets set` não foi rodado. |

Os logs das funções ficam em **Supabase → Edge Functions → whatsapp → Logs**. Toda mensagem ignorada aparece com o motivo.
