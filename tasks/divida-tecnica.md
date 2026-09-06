# Dívida técnica conhecida

Comportamentos que estão errados por decisão adiada (não por bug), com o custo
já mapeado. Não são "arruma quando der" — são decisões de produto pendentes.

---

## Um parcelamento vincula UM orçamento a todas as N parcelas

**Onde:** `CompraParceladaService.cadastrar` / `gerarParcelas` (backend);
`gasto-form-dialog.component` campo "Orçamento (opcional)" no modo parcela
(frontend, `atualizarOpcoesOrcamento`).

**Comportamento atual:**

- O formulário de compra parcelada tem um único campo "Orçamento". O valor
  escolhido é copiado para **todas** as N parcelas (`gasto.setOrcamentoId(compra.getOrcamentoId())`
  no loop de `gerarParcelas`).
- Pior: o dropdown de orçamento no modo parcela lista os orçamentos do **mês
  corrente** (o campo `data` do formulário fica escondido no modo parcela e
  mantém o padrão "hoje"; `atualizarOpcoesOrcamento` filtra por `data.getMonth()`).
  Então uma compra em 12x vinculada a um orçamento acaba com 12 parcelas, em 12
  meses distintos, todas apontando para o orçamento de **um** mês.

**Por que está errado:**

Orçamento é **mensal** (`orcamentos` tem `mes` + `ano`, e o status ok/atenção/
completo/ultrapassou é a soma dos gastos vinculados **naquele mês**). Um
parcelamento **atravessa meses**. O modelo atual não tem como representar
"R$ 500/mês desta compra consomem o orçamento de Moradia de cada um dos 12
meses". Resultado:

- O mês do orçamento escolhido é inflado pelo valor de parcelas que nem caem
  nele.
- Os outros 11 meses não recebem nada da compra, mesmo tendo orçamento de
  Moradia.
- Com cadastro retroativo (`dataPrimeiraParcela` no passado) fica ainda mais
  visível: uma parcela de agosto vinculada a um orçamento de setembro.

**Custo de não consertar:** o vínculo de orçamento numa compra parcelada é
praticamente inútil hoje — quem usa orçamento por categoria e tem parceladas vê
o mês do cadastro estourar e os demais ficarem "sobrando".

**O que seria preciso:** decisão de produto. Opções: (a) não deixar vincular
orçamento numa compra parcelada (o mais simples e honesto); (b) vincular cada
parcela ao orçamento do **seu** mês/categoria automaticamente, criando o
orçamento do mês se não existir (invasivo); (c) um conceito novo de "orçamento
recorrente por categoria" que as parcelas e recorrências consumam.

**Relacionado:** `verificarOrcamentoExcedido` não roda no fluxo de compra
parcelada (só no de gasto avulso) — some do problema, já que o vínculo em si é
questionável.

---

## ~~2.3 — Performance da geração de gastos recorrentes (N+1 no laço de meses)~~ — RESOLVIDO 2026-09-05

**Resolvido:** as 3 otimizações abaixo foram implementadas.
`GastoRecorrenteService.cadastrar` com `mesesGerar=12` foi de **36 → 4** statements
SQL (medido local via `spring.jpa.show-sql` + log do `JdbcTemplate`):
antes `1 select usuarios (auth) + 12 select categorias + 1 insert recorrente + 11
select gastos (exists) + 11 insert gastos`; depois `1 select usuarios (auth) + 1
select categorias + 1 insert recorrente + 1 batch insert`.

- Item 1: `resolverCategoria` roda 1× em `cadastrar`/`atualizar` e passa os nomes
  pra `gerarProximosMeses` (mesmo padrão de `CompraParceladaService`).
- Item 2: numa recorrência nova, `gerarProximosMeses` nem consulta os meses já
  lançados (não há nenhum); o mês corrente entra no mesmo batch quando o dia já
  chegou (sem corrida - a recorrência só fica visível pro lançamento sob demanda
  após o commit). Na edição, uma query só (`datasDosGastosDaRecorrente`) traz
  todas as datas do horizonte, no lugar de 1 `exists` por mês; o mês corrente na
  edição continua pelo `tentarLancar` (trata a corrida com `lancarPendentes`).
- Item 3: `GastoRepository.inserirEmLote` (fragmento custom com `JdbcTemplate.batchUpdate`)
  + `reWriteBatchedInserts=true` no pool. Feito no nível do JDBC porque `Gasto`
  usa `GenerationType.IDENTITY`, que desliga o batch de insert do Hibernate -
  então `hibernate.jdbc.batch_size` **não** foi adicionado (seria inócuo pras
  entidades deste projeto).

Cold start do Neon (item 5 abaixo) segue em aberto - é ortogonal.

Histórico da análise original abaixo, mantido pra referência.

---

**Registrado em:** 2026-09-05, na rodada que adicionou o indicador de loading ao
salvamento de recorrente/parcelada (commit `1810354`). O loading cobre a UX; isto
aqui é o ganho de latência, a tratar numa próxima rodada.

**Onde:** `GastoRecorrenteService.gerarProximosMeses` + `lancarParaMesFuturo` /
`tentarLancar` → `GastoService.cadastrarVinculadoARecorrente` → `salvar` (backend).
Chamado por `cadastrar` e `atualizar` de recorrência.

**Comportamento atual:** laço sequencial, **um mês por vez**, dentro de uma
transação. Por mês:

1. `existsByGastoRecorrenteIdAndDataBetween` — 1 SELECT
2. `resolverCategoria` → `categoriaRepository.findByIdVisivel` — 1 SELECT
   (+ 1 SELECT se houver subcategoria)
3. `validarOrcamento` — 1 SELECT se `orcamentoId != null`
4. `repository.save` — 1 INSERT

Para `mesesGerar = 12`: **~38 a 62 round-trips sequenciais** ao banco (3 por mês no
mínimo, 5 com subcategoria + orçamento), mais a criação da própria recorrência.

**Por que incomoda:**

- **Local (Postgres 14):** ~50–150 ms, imperceptível.
- **Produção (Neon):** cada round-trip carrega a latência VM Oracle ↔ Neon; e o
  Neon serverless escala a zero, então a **primeira** query depois de ocioso pode
  custar segundos sozinha (cold start). É o "demora visivelmente mais" que o
  usuário relatou.

**O que fazer (por ordem de retorno / risco):**

1. **Resolver categoria/subcategoria UMA vez** antes do laço, passando os nomes já
   resolvidos pra cada mês — hoje resolve as mesmas 12×. `CompraParceladaService.salvarParcelas`
   já faz exatamente isso ("resolvidos e validados UMA única vez pelo chamador").
   Corta ~12–24 SELECTs. Baixo risco.
2. **Pular o `exists` na criação** — recorrência recém-criada não tem gasto nenhum
   vinculado, então os 12 `existsByGastoRecorrenteIdAndDataBetween` sempre dão
   `false`. Split do caminho create vs. edit (ou uma flag). Corta ~12 SELECTs. Na
   **edição** manter a checagem (ou trocar por uma query só, buscando todos os
   meses já lançados da recorrência e checando em memória).
3. **Batch dos inserts** — `saveAll` + `spring.jpa.properties.hibernate.jdbc.batch_size`,
   via um método de insert em lote no estilo `salvarParcelas`. 12 INSERTs → 1–2.
4. Combinado: ~38 queries → ~3–4. No Neon, diferença estimada entre ~5 s e ~0,5 s.
5. **Cold start do Neon** é ortogonal — só resolve com tier pago "always-on" ou um
   ping keep-warm; fora do escopo de código.

**Custo de não fazer:** salvar uma recorrência com horizonte alto trava o diálogo
(com spinner, desde `1810354`) por alguns segundos em produção. Sem perda de dado,
sem risco de duplicata (a geração é idempotente e há a constraint
`uq_gastos_recorrente_mes` no banco), só espera.

---

## Pendências abertas em setembro de 2026

- ~~**Endpoint órfão `GET /api/categorias/com-gastos`**~~ — resolvido em 2026-09-05: voltou a ter chamador (`CategoriaService.listarComGastos` no frontend) ao alimentar o dropdown "Filtrar por categoria" da tela de Gastos na correção do achado C1 da auditoria (paginação de `GET /api/gastos`).
- **Sem monitoramento externo na VM da Oracle** — não há health check nem alerta se a API cair (o Render tinha; a VM não tem nada). Quando isso for resolvido, o mesmo mecanismo **deve cobrir a falha de envio de e-mail** (achado M7 da auditoria): hoje o único sinal de SMTP fora do ar é a linha de log `evento=falha_envio_email` em `UsuarioService.esqueciSenha` — padronizada de propósito pra ser fácil de achar (`journalctl -u controle-gastos | grep evento=falha_envio_email`), mas ninguém está olhando ativamente.
- **~16 specs de frontend falhando no baseline** (`ng test`) — `should create` autogerados sem os providers necessários; mascaram falhas novas porque a contagem de falhas não muda quando um teste de verdade quebra (comparar o conjunto de specs que falha, não o número — ver skill `ambiente-local`).
- **Avisos do manifest do PWA** (`controle-gastos-web/public/manifest.json`) — falta o campo `screenshots` (usado pelos navegadores pra mostrar uma prévia rica no prompt de instalação), e os ícones declaram `"purpose": "maskable any"` combinado numa entrada só, quando o recomendado é um conjunto separado por propósito (um ícone maskable bom tem padding extra que um ícone `any` não deveria ter).
- **Tooltip do gráfico de barras cortado no mobile** (`dashboard.component.ts`, `construirBarrasOptions`; wrapper `.grafico-canvas-scroll` em `dashboard.component.css`) — o canvas da visão diária tem `min-width: 900px` com rolagem horizontal (`overflow-x: auto`) num viewport de mobile bem mais estreito. O tooltip nativo do Chart.js é desenhado no bitmap do canvas e só evita sair dos limites do PRÓPRIO canvas (900px) - não sabe nada sobre a janela atualmente visível da rolagem do container pai. Uma barra perto da borda da área visível (mas longe da borda real do canvas) tem o tooltip cortado pelo `overflow-x`. Considerado e descartado por ora: (a) positioner customizado do Chart.js ciente da rolagem do container (esforço médio, mapeamento de coordenadas canvas↔viewport propenso a erro sutil); (b) tooltip externo em HTML/DOM com `position: fixed` (resolve de vez, mas exige reconstruir a aparência do tooltip do zero nos dois temas); (c) auto-rolar o container pra centralizar a barra no hover (mais simples de escrever, mas briga com o gesto de arrastar pra rolar no touch). Nenhuma opção compensava o esforço frente ao impacto (cosmético, só aparece ao passar o mouse/tocar numa barra perto da borda visível da rolagem, nunca afeta o dado mostrado).
