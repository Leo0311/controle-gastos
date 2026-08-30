# Spec: Auto-categorização inteligente + Calendário de contas a pagar

Duas funcionalidades novas no frontend Angular (`controle-gastos-web/`), implementadas
e testadas juntas num único ciclo.

## Suposições que estou fazendo

1. **Nada muda no backend nem no schema.** Ambas as features usam só dados que a API
   já devolve hoje (`GET /api/gastos` retorna todos os gastos do usuário, incluindo
   os futuros pré-gerados, cada um com `data` ISO `yyyy-MM-dd`, `categoriaId`,
   `subcategoriaId`, `gastoRecorrenteId`, `compraParceladaId`). Confirmo isso no fim.
2. **Auto-categorização é 100% client-side**, dentro do `GastoFormDialogComponent`,
   só no modo "Novo gasto" (não ao editar). Usa a lista `GET /api/gastos` carregada
   uma vez na abertura do diálogo.
3. **A correspondência é substring case-insensitive e sem acento** (normalizo os dois
   lados removendo diacríticos além de `toLowerCase`/`trim`). "o texto digitado
   aparece dentro de uma descrição anterior, ou vice-versa" — nos dois sentidos.
4. **Combinação sugerida = categoria+subcategoria mais frequente** entre os gastos
   parecidos. Empate resolve pelo gasto mais recente (itero os candidatos por data
   decrescente e o primeiro a atingir a contagem máxima vence).
5. **Aba "Calendário"** é a 3ª aba de `GastosRecorrentesComponent` (tela
   `/gastos-recorrentes`, título "Recorrentes e Parceladas"). Rótulo: **"Calendário"**.
6. **A aba lista só gastos com `data >= hoje` E (`gastoRecorrenteId` != null OU
   `compraParceladaId` != null)** — não inclui gastos avulsos futuros digitados à mão.
   "hoje" = data local do navegador em `yyyy-MM-dd` (comparação de string ISO).
7. Sem testes unitários novos exigidos além dos que já existem; a validação é o
   ciclo de teste manual (web + mobile 375px) descrito abaixo. Adiciono um `.spec`
   leve só para a função de sugestão (lógica pura), se sair barato.
8. Mobile: 375px é o alvo; reuso os padrões de responsividade já no projeto
   (`@media (max-width: 599px)`, `.lista-recorrentes`, etc.).

→ Me corrija agora ou eu sigo com isso.

## Objetivo

- **Auto-categorização**: reduzir digitação repetitiva. Ao cadastrar um gasto cuja
  descrição se parece com gastos anteriores do próprio usuário, oferecer (sem impor)
  a categoria/subcategoria que ele mais usou nesses casos, aplicável com um clique.
- **Calendário**: dar visão cronológica das contas futuras já comprometidas
  (recorrentes + parcelas), agrupadas por mês com total mensal, num formato de
  agenda/lista que funcione bem no mobile.

## Tech Stack

Angular 18 (standalone), Angular Material 18, RxJS. Sem dependências novas.

## Commands

```
Instalar:  cd controle-gastos-web && npm install
Dev:       cd controle-gastos-web && npm start          # ng serve -> localhost:4200
Build:     cd controle-gastos-web && npm run build
Testes:    cd controle-gastos-web && npm test           # ng test (karma)
API local: cd controle-gastos-api && mvn spring-boot:run # :8080  (precisa do Postgres)
```

## Project Structure (arquivos tocados)

```
controle-gastos-web/src/app/
├── services/gasto.service.ts                         # (sem mudança; já tem listarTodos)
├── features/gastos/gasto-form-dialog/
│   ├── gasto-form-dialog.component.ts                # lógica da sugestão
│   ├── gasto-form-dialog.component.html              # chip/hint abaixo da Descrição
│   ├── gasto-form-dialog.component.css               # estilo do chip
│   └── gasto-form-dialog.component.spec.ts           # (opcional) teste da função pura
└── features/gastos-recorrentes/gastos-recorrentes/
    ├── gastos-recorrentes.component.ts               # aba Calendário: carga + agrupamento
    ├── gastos-recorrentes.component.html             # 3ª <mat-tab>
    └── gastos-recorrentes.component.css              # estilo dos grupos de mês
README.md                                             # documentação das duas features
```

## Code Style

Segue o padrão do projeto: componentes standalone, `inject()`/construtor como já
usado no arquivo, comentários em pt-BR explicando o "porquê", nomes em pt-BR.

```ts
// gasto-form-dialog.component.ts — esboço da sugestão
private readonly gastoService = inject(GastoService);
sugestao: { categoriaId: number; subcategoriaId: number | null; rotulo: string } | null = null;

ngOnInit(): void {
  // ...carga já existente...
  if (!this.editando) {
    this.gastoService.listarTodos().subscribe({
      next: (gastos) => { this.gastosAnteriores = gastos; },
      error: () => { /* sugestão é auxiliar; sem histórico, só não sugere */ }
    });
    this.form.controls.descricao.valueChanges
      .pipe(debounceTime(400), takeUntilDestroyed(this.destroyRef))
      .subscribe((texto) => this.recalcularSugestao(texto ?? ''));
  }
}

private recalcularSugestao(texto: string): void {
  const alvo = this.normalizar(texto);
  if (alvo.length < 3) { this.sugestao = null; return; }
  const parecidos = this.gastosAnteriores
    .filter((g) => g.categoriaId != null)
    .filter((g) => { const d = this.normalizar(g.descricao); return d.includes(alvo) || alvo.includes(d); })
    .sort((a, b) => b.data.localeCompare(a.data));
  // ...conta combinação categoriaId|subcategoriaId mais frequente, monta rotulo com emoji...
}

private normalizar(s: string): string {
  return s.trim().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
}

aplicarSugestao(): void {
  if (!this.sugestao) { return; }
  this.form.controls.categoriaId.setValue(this.sugestao.categoriaId);
  this.atualizarOpcoesSubcategoria();
  this.form.controls.subcategoriaId.setValue(this.sugestao.subcategoriaId);
  this.atualizarOpcoesOrcamento();
  this.sugestao = null;
}
```

```html
<!-- abaixo do mat-form-field da Descrição -->
@if (sugestao) {
  <button type="button" class="chip-sugestao" (click)="aplicarSugestao()">
    <mat-icon inline>auto_awesome</mat-icon>
    Sugestão: {{ sugestao.rotulo }}
    <mat-icon inline class="fechar" (click)="sugestao = null; $event.stopPropagation()">close</mat-icon>
  </button>
}
```

## Testing Strategy

- **Unitário (opcional, barato):** um `it()` no `.spec` do dialog cobrindo
  `recalcularSugestao` (parecidos → sugere combinação certa; sem parecidos → `null`).
- **Manual, um ciclo só (web 1280px + mobile 375px):** ver "Success Criteria".
- `npm run build` tem que passar sem erro/warning novo. `npm test` (suite atual)
  continua verde.

## Boundaries

- **Always:** normalizar entradas antes de comparar; nunca aplicar categoria sem
  clique; nunca desabilitar/travar os selects de categoria/subcategoria; limpar
  dados de teste do banco ao final; atualizar o README antes do commit.
- **Ask first:** qualquer mudança em `controle-gastos-api/` ou `schema.sql`
  (não previsto); adicionar dependência npm (não previsto).
- **Never:** commitar segredos; aplicar sugestão automaticamente; quebrar o fluxo
  atual de recorrente/parcelada no formulário.

## Success Criteria (roteiro do teste manual)

1. Criar 2–3 gastos de teste com descrições parecidas ("Uber trabalho", "Uber casa")
   na mesma categoria+subcategoria (ex.: 🚗 Transporte > Uber/Táxi).
2. Abrir "Novo gasto", digitar "Uber" na Descrição → após ~400ms aparece o chip
   "Sugestão: 🚗 Transporte > Uber/Táxi" abaixo do campo. Clicar aplica
   categoria+subcategoria nos selects; o chip some.
3. Digitar uma descrição sem histórico parecido ("xyz123") → nenhum chip aparece.
4. Com o chip visível, escolher outra categoria manualmente no select → funciona
   normal, nada trava; o chip pode ser fechado no "x".
5. Abrir `/gastos-recorrentes` → aba **"Calendário"** lista os gastos futuros
   (`data >= hoje`) vindos de recorrentes (🔁) e parcelas (💳), ordenados por data,
   agrupados por mês, com o total de cada mês no cabeçalho do grupo (conferir a soma).
6. Sem contas futuras → empty-state apropriado.
7. Tudo verificado também em viewport 375px (chip não estoura a largura; grupos do
   calendário legíveis; nenhuma rolagem horizontal).
8. `npm run build` passa. Dados de teste removidos do banco ao final.
9. Confirmar que nenhuma mudança de schema foi necessária. README atualizado.
   Commit + push.

## Open Questions — RESOLVIDAS

1. Rótulo da aba: **"Próximas contas"**.
2. Chip de sugestão: **esconder quando a combinação categoria+subcategoria já
   selecionada no formulário == a sugerida**; caso contrário continua aparecendo
   até ser aplicado ou fechado no "x".
3. **Incluir** teste unitário para `recalcularSugestao` (lógica pura).
```
