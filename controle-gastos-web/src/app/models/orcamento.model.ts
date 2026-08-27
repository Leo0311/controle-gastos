export interface Orcamento {
  id?: number;
  categoria: string;
  subcategoria?: string | null;
  valorLimite: number;
  mes: number;
  ano: number;
}

export interface OrcamentoMes {
  id: number;
  categoria: string;
  subcategoria: string | null;
  valorLimite: number;
  gasto: number;
  ultrapassou: boolean;
  completo: boolean;
  proximoDoLimite: boolean;
}
