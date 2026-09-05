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

## Pendências abertas em setembro de 2026

- ~~**Endpoint órfão `GET /api/categorias/com-gastos`**~~ — resolvido em 2026-09-05: voltou a ter chamador (`CategoriaService.listarComGastos` no frontend) ao alimentar o dropdown "Filtrar por categoria" da tela de Gastos na correção do achado C1 da auditoria (paginação de `GET /api/gastos`).
- **~16 specs de frontend falhando no baseline** (`ng test`) — `should create` autogerados sem os providers necessários; mascaram falhas novas porque a contagem de falhas não muda quando um teste de verdade quebra (comparar o conjunto de specs que falha, não o número — ver skill `ambiente-local`).
- **Avisos do manifest do PWA** (`controle-gastos-web/public/manifest.json`) — falta o campo `screenshots` (usado pelos navegadores pra mostrar uma prévia rica no prompt de instalação), e os ícones declaram `"purpose": "maskable any"` combinado numa entrada só, quando o recomendado é um conjunto separado por propósito (um ícone maskable bom tem padding extra que um ícone `any` não deveria ter).
- **Tooltip do gráfico de barras cortado no mobile** (`dashboard.component.ts`, `construirBarrasOptions`; wrapper `.grafico-canvas-scroll` em `dashboard.component.css`) — o canvas da visão diária tem `min-width: 900px` com rolagem horizontal (`overflow-x: auto`) num viewport de mobile bem mais estreito. O tooltip nativo do Chart.js é desenhado no bitmap do canvas e só evita sair dos limites do PRÓPRIO canvas (900px) - não sabe nada sobre a janela atualmente visível da rolagem do container pai. Uma barra perto da borda da área visível (mas longe da borda real do canvas) tem o tooltip cortado pelo `overflow-x`. Considerado e descartado por ora: (a) positioner customizado do Chart.js ciente da rolagem do container (esforço médio, mapeamento de coordenadas canvas↔viewport propenso a erro sutil); (b) tooltip externo em HTML/DOM com `position: fixed` (resolve de vez, mas exige reconstruir a aparência do tooltip do zero nos dois temas); (c) auto-rolar o container pra centralizar a barra no hover (mais simples de escrever, mas briga com o gesto de arrastar pra rolar no touch). Nenhuma opção compensava o esforço frente ao impacto (cosmético, só aparece ao passar o mouse/tocar numa barra perto da borda visível da rolagem, nunca afeta o dado mostrado).
