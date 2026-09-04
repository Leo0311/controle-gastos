export interface CompraParcelada {
  id?: number;
  descricao: string;
  valorTotal: number;
  numeroParcelas: number;
  categoriaId: number;
  subcategoriaId?: number | null;
  orcamentoId?: number | null;
  diaDoMes: number;
  ativa?: boolean;
  usuarioId?: number;
  dataCriacao?: string;
  // Só vem preenchido na listagem (GET /api/compras-parceladas): quantas parcelas
  // (gastos vinculados) a compra realmente tem hoje. Menor que numeroParcelas =
  // parcelamento incompleto.
  parcelasLancadas?: number;
}
