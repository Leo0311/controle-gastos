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
