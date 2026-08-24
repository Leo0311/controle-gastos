export interface MetaMes {
  rendaMensal: number | null;
  totalGasto: number;
  economiaReal: number | null;
  metaId: number | null;
  valorMeta: number | null;
  percentualMeta: number | null;
}

export interface MetaRequest {
  mes: number;
  ano: number;
  valorMeta: number;
}

export interface Meta {
  id: number;
  usuarioId: number;
  mes: number;
  ano: number;
  valorMeta: number;
}

export interface Renda {
  rendaMensal: number;
}
