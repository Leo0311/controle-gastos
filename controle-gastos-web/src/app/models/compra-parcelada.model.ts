import { Gasto } from './gasto.model';

export interface CompraParcelada {
  id?: number;
  descricao: string;
  valorTotal: number;
  numeroParcelas: number;
  categoriaId: number;
  subcategoriaId?: number | null;
  orcamentoId?: number | null;
  // Entrada do cadastro (ISO yyyy-MM-dd): data da 1ª parcela, pode ser retroativa.
  // As parcelas seguintes seguem mês a mês a partir dela.
  dataPrimeiraParcela?: string;
  // Derivado de dataPrimeiraParcela no backend; vem nas respostas (rótulo "Todo
  // dia X"), não é enviado no cadastro.
  diaDoMes?: number;
  ativa?: boolean;
  usuarioId?: number;
  dataCriacao?: string;
  // Só vem preenchido na listagem (GET /api/compras-parceladas): quantas parcelas
  // (gastos vinculados) a compra realmente tem hoje. Menor que numeroParcelas =
  // parcelamento incompleto.
  parcelasLancadas?: number;
}

// Resposta de GET /api/compras-parceladas/{id}/detalhe - progresso de pagamento
// (parcelas pagas/lançadas), valor pago/restante em R$, e a lista de parcelas em
// si (o agrupamento por ano é feito no cliente, ver compra-parcelada-detalhe.ts).
// Só leitura - nenhuma ação de pagamento vem daqui.
export interface CompraParceladaDetalhe {
  id: number;
  descricao: string;
  valorTotal: number;
  numeroParcelas: number;
  parcelasLancadas: number;
  parcelasPagas: number;
  valorPago: number;
  valorRestante: number;
  parcelas: Gasto[];
}
