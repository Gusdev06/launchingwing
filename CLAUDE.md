# Launchwing (este diretório)

Objetivo final: pequeno negócio cola o link do produto, recebe peças prontas (meme em vídeo, carrossel educativo, carrossel "amiga"), aprova, e o sistema agenda, publica e mede. Tudo que entra aqui aproxima disso.

## Comandos

```bash
npm install --no-audit --no-fund     # dependências (Node 22+)
npm run dev                          # http://localhost:5173 (login local: /signin-with-chatgpt?return_to=/painel)
npx tsc --noEmit                     # tipos
npm run build                        # build vinext, obrigatório antes de commit
npm run lint                         # eslint
npm run db:generate                  # migração após mudar db/schema.ts (nunca aplicar em produção à mão)
node scripts/pilot/smoke.mjs         # prova das rotas do piloto, precisa do dev rodando
node scripts/painel/smoke.mjs        # prova das rotas do painel, idem
node scripts/painel/arte-smoke.mjs   # geração de imagem contra RunPod falso (RUNPOD_BASE_URL em .dev.vars)
```

Deploy: ChatGPT Sites, conta do Gustavo. Ninguém publica daqui. Entregar commit.

## Arquivos que importam

- `app/chatgpt-auth.ts` identidade (cabeçalhos do ChatGPT). `requireChatGPTUser` em toda página privada.
- `lib/pilot-http.ts` guarda das rotas: 401 sem login, 403 escrita de outra origem, corpo limitado a 12 KB.
- `lib/pilot-store.ts` padrão de gravação no D1: linha por dono, `revision` confere antes de gravar, 409 se mudou.
- `lib/pilot-engine.ts` gerador privado (Claude e Apify) fora deste repo, via `LAUNCHWING_ENGINE_URL` e token. Não dá para testar aqui.
- `app/piloto/frontend/` painel de 14 telas. `model.ts` tipos e dados iniciais. `workspace.tsx` estado e gravação.
- `lib/runpod.ts` cliente do RunPod (imagem por IA). Chaves em `.dev.vars` (modelo em `.dev.vars.example`), nunca no git.
- `db/schema.ts` e `drizzle/` esquema e migrações. Aplicar no D1 local: `sed 's/--> statement-breakpoint//' drizzle/000N_*.sql | sqlite3 .wrangler/state/v3/d1/miniflare-D1DatabaseObject/*.sqlite`.
- `scripts/pilot/*.mjs` provas por execução contra o dev local.

## Decisões

- Banco: D1 (SQLite na Cloudflare) com SQL direto via `env.DB`. Drizzle só gera migração.
- Dados do usuário ficam no servidor, nunca em localStorage. IndexedDB só como cache de rascunho.
- Toda rota privada: identidade pelo cabeçalho, filtro por `owner_id`, `Cache-Control: private, no-store`.
- Escrita concorrente: número de revisão, nunca "último que gravou ganha".
- Segredos só em variáveis do Sites e `.env.local` (ignorado). Nada no front.
- Páginas privadas com `robots: noindex` e `dynamic='force-dynamic'`.

## Estilo

- Português brasileiro nas strings de tela e nos erros. Mensagens de erro dizem o que fazer.
- Código denso, uma declaração por linha longa, como os arquivos existentes. Sem comentário decorativo.
- Sem travessão em lugar nenhum. Sem emoji.
- Nada é "pronto" sem prova por execução: tsc, build e o smoke correspondente.

## Fluxo de issue

`/issue-start <descrição>` planeja, `/issue-verify` prova, `/issue-close` commita. Uma issue por vez.
