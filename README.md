# Launchwing — landing page Lift

**Baixar pacote para postar à mão — 27/09/2026:** na galeria, "Baixar pacote" gera um ZIP com os conteúdos salvos (filtro atual), e no editor "Baixar esta peça" gera o da peça aberta. Cada pasta traz as fotos numeradas (ou o vídeo), `legenda.txt` e `textos-dos-slides.txt`; o texto sobre a foto não é gravado na imagem. Exportador em `lib/workspace-export.ts`, reaproveitando o escritor de ZIP do piloto. Prova: `scripts/painel/export-smoke.mjs` (8 verificações, ZIP lido pelo Python) e tela real (ZIP de 1 MB gerado no navegador).

**Imagem por IA no editor — 27/09/2026:** botão "Criar imagem com IA" no editor de slides gera pelo RunPod Serverless da conta do Gustavo (endpoint Krea 2, mesmo workflow de `krea2-comfy-api`). Rotas `POST /api/painel/arte` e `GET /api/painel/arte/{id}`; tabela `art_jobs` (migração `0003_keen_stick.sql`); a imagem pronta vira arquivo da conta e entra na galeria em "Imagens por IA". Teto de 60 imagens por conta em 24 h. Variáveis: `RUNPOD_API_KEY`, `RUNPOD_KREA2_ENDPOINT_ID` (modelo em `.dev.vars.example`; em produção, nas variáveis do Sites). Sem elas o botão avisa que não está conectado. Provado só contra um RunPod falso (`scripts/painel/arte-smoke.mjs`, 13 verificações, e tela real); não foi exercitado contra GPU de verdade, o que custa dinheiro e depende da chave dele.

**Painel salvo na conta — 27/09/2026:** `/painel` deixa de guardar dados só no navegador. Cada usuário tem uma linha em `workspaces` (D1) com número de revisão, e os arquivos enviados (logo, mídias, até 20 MB) ficam em `workspace_files` em pedaços de 900 KB, servidos por `/api/painel/arquivo/{id}` só ao dono. Na primeira abertura, o rascunho antigo do IndexedDB sobe uma vez para a conta. Migração `0002_nostalgic_chameleon.sql` (aplicar no D1 de produção pelo fluxo do Sites antes de publicar). Prova: `scripts/painel/smoke.mjs`, 19 verificações, e tela real conferida no navegador. Contexto curto para agentes em `CLAUDE.md` e comandos `/issue-*` em `.claude/commands`.

**Produto local — 12/09/2026:** espaço completo de frontend em `/painel`, autenticado; navegação também integrada ao piloto após onboarding. 14 telas, editor de slides, galeria/Marca e planejamento local via IndexedDB. Conteúdos reais continuam usando API/revisão/exportador do piloto. Novas integrações sociais, tendências, renderização de arte e jobs de campanha ainda pendentes. [Registro completo](../context/frontend-mvp-2026-09-12.md). TypeScript e build Sites aprovados, sem novo deploy.

Página de acesso antecipado, criada em 2026-09-10. Identidade Lift; Manrope local; mercado Brasil. Copy representa o MVP planejado, ainda não disponível.

## Experiência

Estado local em 11/09: Studio como principal, hero com vídeos e imagem FeelRun, quatro exemplos editoriais navegáveis (incluindo carrosséis de três/cinco slides), contexto de produto/público/situação, problema, mecanismo editorial, fluxo em três etapas, três mockups reservados para provas, sete FAQs e cadastro de e-mail. Exemplos são estudos editoriais, não saídas de um produto operacional. Botões principais levam ao formulário; não há checkout, assinatura ou envio automático de e-mail.

## Conteúdo e dados

`app/page.tsx` e `app/layouts/studio/page.tsx`: entradas da Studio. `app/layouts/studio/landing.tsx` e `studio.css`: nova copy e mockups de prova. `app/layouts/concept.tsx`: mídia, exemplos e cadastro compartilhados. `app/globals.css` e `app/layouts/layouts.css`: base visual e responsividade. `public/brand/`: kit Lift e fonte com OFL. `app/api/waitlist/route.ts`: validação de envio; `lib/waitlist.ts`: insert preparado. Tabela `waitlist`: e-mail normalizado como chave, versão do consentimento e data. Não há endpoint público para leitura de cadastros. Não salvar lista em localStorage.

## Execução

- `npm run dev`: preview local.
- `npm run db:generate`: gerar migrações após alterar `db/schema.ts`.
- `npx tsc --noEmit`: checagem de tipos.
- Build e publicação seguem as skills Sites. Manter o project_id de `.openai/hosting.json`.
- Migrações de preview: seguir o guia Sites; não executar migrações de produção manualmente.

## Validação em 2026-09-10

Build e TypeScript. GET local retornou 200. Cadastro válido 200; e-mail duplicado com caixa diferente 200 e apenas uma linha; inválido 400; origem estrangeira 403. Persistência confirmada no D1 local; dado de teste removido. Revisão estática de assets, âncoras e media queries. Nenhum envio de e-mail ou teste com dados reais. Sem teste visual/interativo em navegador nesta entrega.

## Publicação

Site com acesso privado do proprietário e `noindex` durante revisão. URL confirmada: https://launchwing-lift.gusdeve7.chatgpt.site . Publicada v6; revisão local de copy/provas de 11/09 ainda sem deploy.

O domínio launchwing.app não está conectado e sua compra não foi confirmada. A abertura pública e o envio de avisos são etapas posteriores. A lista salva interesse; nenhum convite é enviado automaticamente. Revisão de privacidade e canal de atendimento precisam acompanhar a abertura pública.

## Revisão local de copy e provas — 2026-09-11

TypeScript, build Sites e `git diff --check` aprovados. Navegador em 390×844 e 1440×1000 sem overflow horizontal ou imagens quebradas; exemplos, slides e FAQ conferidos. Backend do cadastro preservado, sem novo envio real. Detalhes e mapa dos três espaços em `../context/studio-copy-provas-2026-09-11.md`.

## Piloto assistido — 2026-09-11

`/piloto` é área protegida com casos por usuário. `lib/pilot-model.ts` valida transições; `pilot-store.ts` persiste em D1 com controle de revisão; `pilot-cases.ts`, `pilot-geraew.json` e `pilot-insta-radar.json` carregam os dois casos assistidos; rotas em `app/api/pilot/`. Nova migração `0001_round_winter_soldier.sql` aplicada apenas no D1 local, sem mudar waitlist.

GERAEW e Insta Radar têm contexto e três peças preparados por produto. Outros links ficam aguardando produção assistida; não há crawler ou geração automática. Assets GERAEW em `public/pilot/geraew`, reaproveitados com origem registrada; Insta Radar em `public/pilot/insta-radar`, três imagens novas feitas pelo assistente nativo fora do runtime. Edição de legenda, decisão, justificativa e tempo aproximado salvos; baixar mídia/exportar legendas não publica conteúdo. Proteger a área via autenticação e isolamento de dados mesmo se a landing for aberta futuramente.

Build/TypeScript e teste `scripts/pilot/smoke.mjs` aprovados (12 verificações). Caso real local de demonstração pendente de confirmação; dois casos técnicos removidos. Sem nova QA visual/browser, sem deploy. Documentação operacional em `../growth/prototipo-2026-09-11/README.md`.


## Segundo caso do piloto — 2026-09-11

Insta Radar integrado ao catálogo e à entrada do protótipo; contexto, origem da mídia e download de imagem única deixam de depender do caso GERAEW. Texto de exportação aceita mídia nova ou reaproveitada; exportar desabilita enquanto houver edição não salva. Sem alteração de schema/migração nesta extensão.

TypeScript, build Sites e diff check aprovados. `scripts/pilot/second-case-smoke.mjs`: seis verificações passaram, três registros técnicos removidos; caso novo de demonstração salvo em contexto, sem confirmação/aprovação. [Pacote e validação](../growth/insta-radar-piloto-2026-09-11/README.md). Revisão visual dos PNGs concluída; sem nova QA no navegador, sem deploy.


## Estado vigente do piloto — três formatos casuais, 11/09/2026

Insta Radar agora prepara meme em vídeo de 8s, slideshow educativo de seis slides e slideshow em tom de amiga de seis slides, com as mídias v2 aprovadas. Originais antigos e casos já preparados permanecem preservados. Novo caso local: `5d2821e2-f18d-4782-b879-0c08d93ec36a`, em revisão, sem peças aprovadas pelo assistente.

`lib/pilot-export.ts` monta ZIP da peça ou das aprovadas com mídia ordenada, legenda salva e procedência. Sem nova dependência, schema ou migração. Download bloqueado com edição não salva; falha ao receber mídia inválida. `scripts/pilot/export-smoke.mjs` valida integridade ZIP com leitor independente e compara bytes/legendas; os dois smoke tests de API totalizam 18 verificações aprovadas. TypeScript/build passaram. Doze slides, persistência de edição e telas 390/1280 conferidos no navegador. Cinco casos de QA removidos.

O evento de download não foi retornado pelo navegador integrado, apesar de nenhum erro na UI/console; salvamento no sistema não confirmado. Integração local, sem deploy. [Registro completo](../context/piloto-tres-formatos-integracao-2026-09-11.md).

## Estado vigente — Claude API real, teste privado, 11/09/2026

Esta seção supera a descrição anterior de geração assistida para novas URLs. `/piloto` agora analisa o site com Claude API e, após confirmar o contexto, gera copy, busca fotos Pinterest via Apify, seleciona imagens com Claude e monta os três formatos automaticamente. Demonstrações antigas continuam no modo explícito `demo`.

O renderer roda no serviço local `../engine` (127.0.0.1:8789), separado do runtime do Site. O processo precisa permanecer ativo para gerar e servir mídias; não é infraestrutura pública de produção. Credenciais ficam em arquivos ignorados, com token de ligação em `.env.local`, nunca no frontend/build. Não houve deploy nem alteração de acesso.

Caso real concluído: `29baa3d1-5b53-49ce-96ae-2d4fd11f8a18`, três peças pendentes. 13 mídias autenticadas, 3 ZIPs reais, 18 checks de regressão e 24 testes do engine validados; TypeScript/build passaram. Original CreatorSet disponível: Travolta confuso; não há API CreatorSet. Feedback não regenera automaticamente.

[Como iniciar o gerador](../engine/README.md) · [Registro, limites e evidências](../context/claude-api-piloto-2026-09-11.md).
