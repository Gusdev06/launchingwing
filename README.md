# Launchwing — landing page Lift

Página de acesso antecipado, criada em 2026-09-10. Identidade Lift; Manrope local; mercado Brasil. Copy representa o MVP planejado, ainda não disponível.

## Experiência

Uma página com hero, problema, fluxo em três etapas, sete exemplos editoriais navegáveis, seis FAQs e cadastro de e-mail. Exemplos são capas e legendas ilustrativas, não carrosséis completos gerados pelo produto. Botões levam ao formulário; não há checkout, assinatura ou envio automático de e-mail.

## Conteúdo e dados

`app/page.tsx`: copy e interações. `app/globals.css`: estilos responsivos e movimento reduzido. `public/brand/`: kit Lift e fonte com OFL. `app/api/waitlist/route.ts`: validação de envio; `lib/waitlist.ts`: insert preparado. Tabela `waitlist`: e-mail normalizado como chave, versão do consentimento e data. Não há endpoint público para leitura de cadastros. Não salvar lista em localStorage.

## Execução

- `npm run dev`: preview local.
- `npm run db:generate`: gerar migrações após alterar `db/schema.ts`.
- `npx tsc --noEmit`: checagem de tipos.
- Build e publicação seguem as skills Sites. Manter o project_id de `.openai/hosting.json`.
- Migrações de preview: seguir o guia Sites; não executar migrações de produção manualmente.

## Validação em 2026-09-10

Build e TypeScript. GET local retornou 200. Cadastro válido 200; e-mail duplicado com caixa diferente 200 e apenas uma linha; inválido 400; origem estrangeira 403. Persistência confirmada no D1 local; dado de teste removido. Revisão estática de assets, âncoras e media queries. Nenhum envio de e-mail ou teste com dados reais. Sem teste visual/interativo em navegador nesta entrega.

## Publicação

Site criado com acesso privado do proprietário. `noindex` durante revisão. URL prevista: https://launchwing-lift.balmy-park-8925.chatgpt.site . Confirmar sucesso pelo Sites antes de tratar como publicada.

O domínio launchwing.app não está conectado e sua compra não foi confirmada. A abertura pública e o envio de avisos são etapas posteriores. A lista salva interesse; nenhum convite é enviado automaticamente. Revisão de privacidade e canal de atendimento precisam acompanhar a abertura pública.
