export interface GastoRecorrente {
  id?: number;
  descricao: string;
  valor: number;
  categoriaId: number;
  subcategoriaId?: number | null;
  diaDoMes: number;
  orcamentoId?: number | null;
  ativo?: boolean;
  usuarioId?: number;
  dataCriacao?: string;
  // Só usado ao criar/editar (entrada), nunca vem preenchido nas respostas da API -
  // ver GastoRecorrenteService.gerarProximosMeses no backend.
  mesesGerar?: number;
}
