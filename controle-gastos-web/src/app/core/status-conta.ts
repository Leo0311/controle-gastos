import { Gasto } from '../models/gasto.model';

/**
 * Lógica pura de status de pagamento de um gasto (sem Angular, testável sem
 * TestBed). "Atrasada" NÃO é um valor gravado no backend - é calculado aqui, na
 * leitura: um gasto PENDENTE cujo vencimento já passou. Mesma filosofia do
 * agrupamento da aba "Próximas contas", feito no cliente.
 */

export type StatusConta = 'PENDENTE' | 'PAGO' | 'ATRASADA';

/** Data de hoje em ISO (yyyy-MM-dd), no fuso local. */
export function hojeIso(hoje: Date = new Date()): string {
  const ano = hoje.getFullYear();
  const mes = String(hoje.getMonth() + 1).padStart(2, '0');
  const dia = String(hoje.getDate()).padStart(2, '0');
  return `${ano}-${mes}-${dia}`;
}

/** true quando o gasto veio de uma recorrência ou de uma compra parcelada. */
export function ehGastoDeConta(gasto: Gasto): boolean {
  return gasto.gastoRecorrenteId != null || gasto.compraParceladaId != null;
}

/**
 * Status a exibir para um gasto: PAGO se a API marcou assim; senão ATRASADA se o
 * vencimento (original, ou a própria data como fallback de dado legado) já passou;
 * senão PENDENTE. Gasto avulso vem sempre 'PAGO' da API, então cai em PAGO.
 */
export function statusDaConta(gasto: Gasto, hoje: string = hojeIso()): StatusConta {
  if (gasto.statusPagamento === 'PAGO' || gasto.statusPagamento == null) {
    return 'PAGO';
  }
  const vencimento = gasto.vencimentoOriginal ?? gasto.data;
  return vencimento < hoje ? 'ATRASADA' : 'PENDENTE';
}

/** Rótulo curto do chip. */
export function rotuloStatus(status: StatusConta): string {
  return status === 'PAGO' ? 'Pago' : status === 'ATRASADA' ? 'Atrasada' : 'Pendente';
}

/** Sufixo de classe CSS do chip (chip-status-pago / -pendente / -atrasada). */
export function classeStatus(status: StatusConta): string {
  return status.toLowerCase();
}

// Contagem agregada de ocorrências de uma fonte (recorrência/parcela) por status.
// Os totais vêm do backend (GET /api/gastos/status-por-fonte); este tipo é só o
// formato que os badges das abas Recorrentes/Parceladas consomem.
export interface ResumoStatusConta {
  pendentes: number;
  atrasadas: number;
}
