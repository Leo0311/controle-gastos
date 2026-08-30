# Plano de implementação

Ref: `SPEC-auto-categorizacao-e-calendario.md`. Duas features independentes, sem
backend. Ordem: A (auto-categorização) → B (calendário) → teste único → README → commit.

## Módulo A — Auto-categorização (GastoFormDialogComponent)

1. Injetar `GastoService`; adicionar `DestroyRef`. Campo `gastosAnteriores: Gasto[]`.
2. Em `ngOnInit`, se `!this.editando`: carregar `listarTodos()` e assinar
   `descricao.valueChanges` com `debounceTime(400)` + `takeUntilDestroyed`.
3. `normalizar(s)` — trim + lowercase + remove diacríticos.
4. `recalcularSugestao(texto)` — < 3 chars limpa; filtra `categoriaId != null` +
   match substring bidirecional; ordena por `data` desc; conta combinação
   `categoriaId|subcategoriaId` mais frequente; monta `rotulo` = `emoji cat > sub`
   (usa `todasCategorias`/`todasSubcategorias`); guarda em `sugestao` ou `null`.
   Esconde se a combinação sugerida == a já selecionada no form.
5. `aplicarSugestao()` — set categoriaId, `atualizarOpcoesSubcategoria()`, set
   subcategoriaId, `atualizarOpcoesOrcamento()`, `sugestao = null`.
6. HTML: bloco `@if (sugestao)` logo após o mat-form-field da Descrição, botão-chip
   com ícone `auto_awesome`, texto e um `close` que faz `sugestao = null`.
7. CSS: `.chip-sugestao` discreto, tema-aware (usa custom props já existentes),
   `max-width: 100%`, quebra de texto ok no mobile.
8. `.spec`: `it()` para `recalcularSugestao` (com/sem parecidos).

## Módulo B — Aba "Próximas contas" (GastosRecorrentesComponent)

1. Injetar `GastoService`. Tipos locais: `ItemCalendario` e `GrupoMes`.
2. `carregarCalendario()` — `listarTodos()`; filtra `data >= hojeIso()` e
   (`gastoRecorrenteId != null || compraParceladaId != null`); ordena por `data`;
   agrupa por `data.slice(0,7)`; cada grupo: `rotuloMes` ("Setembro 2026"),
   `total` (soma), `itens`. Estado `calendario: GrupoMes[]`, `carregandoCalendario`.
3. Chamar no `ngOnInit`.
4. HTML: 3ª `<mat-tab label="Próximas contas">` com spinner / empty-state
   (`icon="event"`) / lista de grupos. Cada item: data `dd/mm`, descrição, valor,
   ícone 🔁 (`compraParceladaId` nulo) ou 💳.
5. CSS: `.grupo-mes`, `.cabecalho-mes` (nome + total), reaproveita `.item-recorrente`
   ou cria `.item-calendario`; responsivo 375px.

## Teste (um ciclo) — ver Success Criteria da spec

Postgres + API (:8080) + web (:4200). Cadastrar usuário de teste, 3 gastos "Uber*"
+ 1 recorrente + 1 parcelada. Verificar sugestão, ausência de sugestão, não-trava,
aba Próximas contas (agrupamento + total), 375px. Limpar dados. `npm run build`.

## README + commit

Subseção nova em Gastos (auto-categorização) e em Recorrentes/Parceladas
(Próximas contas). Commit + push. Confirmar: sem mudança de schema.
