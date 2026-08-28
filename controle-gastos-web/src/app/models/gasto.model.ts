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
