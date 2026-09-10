export interface Gasto {
  id?: number;
  descricao: string;
  valor: number;
  categoriaId: number;
  subcategoriaId?: number | null;
  // Nome espelhado da categoria/subcategoria, devolvido pela API só para leitura -
  // fallback de exibição para gastos legados (sem categoriaId, ex. gravados pelo
  // console). Nunca precisa ser enviado ao criar/editar: a API resolve a partir
  // de categoriaId/subcategoriaId.
  categoria?: string;
  subcategoria?: string | null;
  data: string; // formato ISO yyyy-MM-dd, igual ao retornado pela API
  orcamentoId?: number | null;
  // Preenchido pela API só quando o gasto foi criado automaticamente a partir de uma
  // recorrência (ver GastoRecorrente) - usado só para exibir o ícone 🔁 na listagem.
  gastoRecorrenteId?: number | null;
  // Preenchido pela API só quando o gasto é uma parcela de uma compra parcelada (ver
  // CompraParcelada) - usado só para exibir o ícone 💳 na listagem.
  compraParceladaId?: number | null;
  // Status de pagamento. Gasto avulso vem sempre 'PAGO'; só gasto de recorrência/
  // parcela pode vir 'PENDENTE'. "Atrasada" NÃO é um valor da API - é calculado no
  // cliente (PENDENTE + vencimentoOriginal no passado) - ver core/status-conta.ts.
  statusPagamento?: 'PENDENTE' | 'PAGO';
  // Dia do vencimento original (ISO yyyy-MM-dd), preservado mesmo depois de pago.
  // null para gasto avulso (não tem vencimento).
  vencimentoOriginal?: string | null;
  // Data real do pagamento (ISO yyyy-MM-dd). Para avulso = a própria data.
  dataPagamento?: string | null;
}

// Uma página da listagem da tela de Gastos (GET /api/gastos/pagina) - espelha o
// GastoPaginaDTO do backend. `ultima` diz se o botão "Carregar mais" some.
export interface PaginaGastos {
  conteudo: Gasto[];
  pagina: number;
  totalPaginas: number;
  totalItens: number;
  ultima: boolean;
}

// Contadores agregados de uma fonte de contas (recorrência ou compra parcelada) -
// resposta de GET /api/gastos/status-por-fonte. Alimenta os badges das abas
// Recorrentes/Parceladas e o "N lançamentos futuros" da aba Recorrentes, sem o
// cliente precisar baixar a lista inteira de gastos. `futuros` só é usado para
// RECORRENTE (lançamentos já gerados com data de hoje em diante).
export interface StatusPorFonte {
  tipo: 'RECORRENTE' | 'PARCELADA';
  id: number;
  pendentes: number;
  atrasadas: number;
  futuros: number;
}

export interface CategoriaTotal {
  categoriaId: number | null;
  categoria: string;
  total: number;
}

export interface Resumo {
  totalGeral: number;
  porCategoria: CategoriaTotal[];
}

export interface TotalMensal {
  mes: number;
  ano: number;
  total: number;
}

export interface TotalDiario {
  dia: number;
  total: number;
}
