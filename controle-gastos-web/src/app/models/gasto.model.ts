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
