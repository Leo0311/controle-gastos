export interface Orcamento {
  id?: number;
  categoriaId: number;
  subcategoriaId?: number | null;
  // Nome espelhado, só para leitura - ver comentário equivalente em Gasto.
  categoria?: string;
  subcategoria?: string | null;
  valorLimite: number;
  mes: number;
  ano: number;
}

export interface OrcamentoMes {
  id: number;
  categoriaId: number | null;
  categoria: string;
  subcategoriaId: number | null;
  subcategoria: string | null;
  valorLimite: number;
  gasto: number;
  ultrapassou: boolean;
  completo: boolean;
  proximoDoLimite: boolean;
}
