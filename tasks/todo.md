# Tarefas — CONCLUÍDAS

- [x] A1. GastoFormDialogComponent: injeção de GastoService/DestroyRef, carga de gastos, assinatura de descricao com debounce
- [x] A2. Lógica `normalizar` + `recalcularSugestao` + `aplicarSugestao` (extraída para `sugestao-categoria.ts`, pura e testável)
- [x] A3. Chip no HTML + CSS tema-aware e responsivo
- [x] B1. GastosRecorrentesComponent: `carregarCalendario` + agrupamento por mês
- [x] B2. 3ª aba "Próximas contas" no HTML + CSS
- [x] C1. Ciclo de teste único (web 1280px + mobile 375px + tema escuro) — todos os cenários da spec passaram
- [x] C2. Limpar dados de teste do banco (usuário 66 e tudo dele; banco de volta a 6 usuários / 11 gastos)
- [x] C3. Atualizar README.md (seções "Auto-categorização inteligente" e "Calendário de contas a pagar")
- [x] C4. Sem mudança de schema (API subiu com ddl-auto=validate sem erro); teste unitário novo (`sugestao-categoria.spec.ts`, 6 casos) passa; `npm run build` limpo

## Notas

- A suíte karma pré-existente tem 16 testes quebrados (specs `should create`/`should be created`
  gerados pelo Angular CLI, sem providers de MatDialogRef/HttpClient/MAT_DIALOG_DATA). Não é
  regressão desta mudança; fora do escopo. Os 6 testes novos de `sugestao-categoria` passam.
