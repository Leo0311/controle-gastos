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
}
