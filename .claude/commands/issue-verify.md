Prove o estado atual deste repositório, nesta ordem, e pare no primeiro que falhar:

```bash
npx tsc --noEmit
npm run build
npm run lint
```

Depois, com `npm run dev` rodando em outra aba (`mcp__terminal__run_in_terminal`), rode os smokes que existem em `scripts/*/smoke.mjs`. Reporte no painel de status: o que passou, o que falhou com a saída, e o que não foi possível provar (o gerador privado não roda aqui).
