# Launchwing (este diretório)

Objetivo final: pequeno negócio cola o link do produto, recebe peças prontas (meme em vídeo, carrossel educativo, carrossel "amiga"), aprova, e o sistema agenda, publica e mede. Tudo que entra aqui aproxima disso.

## Comandos

```bash
npm install --no-audit --no-fund     # dependências (Node 22+)
npm run dev                          # http://localhost:5173 (login local: LOGIN_PROPRIO=1 e LOGIN_EMAIL_TESTE=1 em .dev.vars, código em /entrar sai no terminal)
npx tsc --noEmit                     # tipos
npm run build                        # build vinext, obrigatório antes de commit
npm run lint                         # eslint
npm run db:generate                  # migração após mudar db/schema.ts (nunca aplicar em produção à mão)
node scripts/pilot/smoke.mjs         # prova das rotas do piloto, precisa do dev rodando
node scripts/painel/smoke.mjs        # prova das rotas do painel, idem
node scripts/painel/sem-ia-paga-smoke.mjs # prova que nenhuma chamada paga de IA sai do site (rota de imagem 404), idem
node scripts/painel/export-smoke.mjs # pacote ZIP do painel, sem servidor
node scripts/painel/access-smoke.mjs # JWT do Cloudflare Access, sem servidor
node scripts/login/regras-smoke.mjs  # regras do login próprio por código no e-mail, sem servidor
node scripts/login/rotas-smoke.mjs   # login próprio de ponta a ponta, sobe o próprio servidor (npm run build antes)
node scripts/docs/regras.mjs         # CLAUDE.md, README e .dev.vars.example batem com o código, sem servidor
node scripts/saude/commit-regras.mjs # commit publicado em /api/saude e no deploy, sem servidor
node scripts/pilot/cota-regras.mjs   # 3 lotes por caso, o 4º é recusado, sem servidor
node scripts/conf/registrar-erro-regras.mjs # todo catch grava JSON com a causa e sem e-mail, sem servidor
node scripts/pilot/cota-concorrente-smoke.mjs # cotas por conta e do sistema com envios ao mesmo tempo, sobe o próprio servidor (npm run build antes)
node scripts/waitlist/smoke.mjs      # lista de espera guarda cada e-mail uma vez, sobe o próprio servidor (npm run build antes)
npm test                             # o mesmo que npm run test:unit
npm run db:migrate:local             # tabelas no banco do dev (depois de npm run build)
```

Provar: `npm run check` (tipos, build, lint e `test:unit`: as provas sem servidor, `scripts/*/*-regras.mjs` e os `export-smoke`, `access-smoke`, `lote-smoke`), depois `npm run test:e2e` (`login/rotas-smoke`, `pilot/esqueleto-smoke`, `pilot/cota-concorrente-smoke`, `waitlist/smoke`: cada um sobe o próprio servidor) e os `scripts/*/smoke.mjs` com o dev rodando.

Deploy: direto na Cloudflare com `npm run deploy` (token de API no ambiente; ver README). O ChatGPT Sites saiu em 28/09/2026. Login próprio por código no e-mail desde 06/10 (`lib/login-codigo.ts`, `lib/login-d1.ts`, rotas `/entrar`, `/api/entrar/*`, `/sair`); o Cloudflare Access (`lib/access-jwt.ts`) continua como segunda opção.

## Arquivos que importam

- `app/chatgpt-auth.ts` identidade, nesta ordem: (1) sessão do login próprio, com `LOGIN_PROPRIO=1` (código por e-mail via Resend com `RESEND_API_KEY` e `LOGIN_EMAIL_DE`; com `LOGIN_EMAIL_TESTE=1` o código sai no terminal, só no localhost); (2) JWT do Cloudflare Access, com `CF_ACCESS_TEAM_DOMAIN` e `CF_ACCESS_AUD`; (3) cabeçalhos do ChatGPT, só com `ALLOW_CHATGPT_HEADERS=1` (dev local). `requireChatGPTUser` em toda página privada. Provas em `scripts/login/*`.
- `lib/pilot-http.ts` guarda das rotas: 401 sem login, 403 escrita de outra origem, corpo limitado a 12 KB.
- `lib/pilot-store.ts` padrão de gravação no D1: linha por dono, `revision` confere antes de gravar, 409 se mudou.
- `lib/pilot-engine.ts` gerador privado (Claude e Apify) fora deste repo, via `LAUNCHWING_ENGINE_URL` e token. Não dá para testar aqui.
- `app/piloto/frontend/` painel de 14 telas. `model.ts` tipos e dados iniciais. `workspace.tsx` estado e gravação.
- Imagem e vídeo por IA saíram do site em 08/10/2026 (decisão do Gustavo: nenhuma chamada paga sai daqui). A tabela `art_jobs` ficou no esquema até uma migração a parte. Chaves em `.dev.vars` (modelo em `.dev.vars.example`), nunca no git.
- `db/schema.ts` e `drizzle/` esquema e migrações. Aplicar: `npm run db:migrate:local` ou `:remote`.
- `scripts/pilot/*.mjs` provas por execução contra o dev local.

## Decisões

- Banco: D1 (SQLite na Cloudflare) com SQL direto via `env.DB`. Drizzle só gera migração.
- Dados do usuário ficam no servidor, nunca em localStorage. IndexedDB só como cache de rascunho.
- Toda rota privada: identidade pelo cabeçalho, filtro por `owner_id`, `Cache-Control: private, no-store`.
- Escrita concorrente: número de revisão, nunca "último que gravou ganha".
- Segredos só em `.dev.vars` (ignorado) e nos segredos do Worker na Cloudflare. Nada no front.
- Páginas privadas com `robots: noindex` e `dynamic='force-dynamic'`.

## Estilo

- Português brasileiro nas strings de tela e nos erros. Mensagens de erro dizem o que fazer.
- Código denso, uma declaração por linha longa, como os arquivos existentes. Sem comentário decorativo.
- Sem travessão em lugar nenhum. Sem emoji.
- Nada é "pronto" sem prova por execução: tsc, build e o smoke correspondente.

## Fluxo de issue

Da raiz: `/issues` e `/issue launchingwing <número>`. Dentro desta pasta: `/issue-start <descrição>`, `/issue-verify`, `/issue-close`. Uma issue por vez.
