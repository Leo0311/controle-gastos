export interface Gasto {
  id?: number;
  descricao: string;
  valor: number;
  categoria: string;
  data: string; // formato ISO yyyy-MM-dd, igual ao retornado pela API
  orcamentoId?: number | null;
}

export interface CategoriaTotal {
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
