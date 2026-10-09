# Launchwing

## O que é

Um pequeno negócio cola o link do produto, recebe peças prontas para redes sociais (meme em vídeo, carrossel educativo, carrossel "amiga"), aprova, e o sistema agenda, publica e mede. App Next (vinext) rodando como Worker na Cloudflare, com banco D1. O motor que gera as peças fica em outro repositório e é chamado por `LAUNCHWING_ENGINE_URL`.

Contexto para agentes e decisões em `CLAUDE.md`. O diário das entregas antigas está em `docs/historico.md`; o resto o `git log` guarda.

## Como rodar

```bash
npm install --no-audit --no-fund                 # Node 22+
cp .dev.vars.example .dev.vars                   # preencha o que for usar; LOGIN_PROPRIO=1 e LOGIN_EMAIL_TESTE=1 para o login local
npm run build && npm run db:migrate:local && npm run dev   # tabelas no banco local e servidor em http://localhost:5173
```

Com `LOGIN_PROPRIO=1` e `LOGIN_EMAIL_TESTE=1`, abra `/entrar`, informe um e-mail e pegue o código no terminal do servidor (linha `[login-teste]`). A ordem de identidade está em `app/chatgpt-auth.ts`.

## Como provar e publicar

```bash
npm run check          # tipos, build, lint e test:unit (provas sem servidor)
npm run test:e2e       # provas que sobem o próprio servidor local (login, piloto, cotas, lista de espera); npm run build antes
npm run deploy         # build, migração remota e wrangler deploy; exige CLOUDFLARE_API_TOKEN, CLOUDFLARE_ACCOUNT_ID, CLOUDFLARE_D1_ID e CLOUDFLARE_D1_NAME no ambiente
```

Depois do deploy, a prova de que o código novo está no ar é o campo `commit` de `/api/saude` igual ao commit publicado. Os segredos de produção entram com `npx wrangler secret put <NOME> -c dist/server/wrangler.json`, um por variável de `.dev.vars.example`.
