export interface RankingSubcategoria {
  subcategoriaId: number | null;
  subcategoria: string;
  total: number;
  /** Percentual do total da categoria (não do total geral do mês). */
  percentual: number;
}

export interface RankingCategoria {
  categoriaId: number | null;
  categoria: string;
  total: number;
  /** Percentual do total geral do mês. */
  percentual: number;
  subcategorias: RankingSubcategoria[];
}

export interface RankingCategorias {
  totalGeral: number;
  categorias: RankingCategoria[];
}

export interface ComparacaoCategoria {
  categoriaId: number | null;
  categoria: string;
  totalAtual: number;
  totalAnterior: number;
  variacaoAbsoluta: number;
  /** Nulo quando totalAnterior é zero (categoriaNova = true). */
  variacaoPercentual: number | null;
  categoriaNova: boolean;
}

export interface ComparacaoMensal {
  mes: number;
  ano: number;
  mesAnterior: number;
  anoAnterior: number;
  categorias: ComparacaoCategoria[];
}
