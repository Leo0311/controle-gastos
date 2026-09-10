import { Gasto } from '../../models/gasto.model';
import { MESES_NOMES } from '../../core/meses';
import { StatusConta, hojeIso, statusDaConta } from '../../core/status-conta';

export { hojeIso };

/**
 * Lógica pura da aba "Próximas contas" (achado M8): agrupamento dos lançamentos
 * futuros por mês e contagem por recorrência, sem Angular, testável sem TestBed.
 * O componente `proximas-contas.component.ts` só chama estas funções e cuida da
 * janela de meses visíveis; o carregamento dos gastos fica no componente pai.
 */

/** Um lançamento (recorrente ou parcela) na aba "Próximas contas". */
export interface ItemCalendario {
  id: number;
  data: string;
  descricao: string;
  valor: number;
  origem: 'recorrente' | 'parcela';
  status: StatusConta;
  gastoRecorrenteId: number | null;
  compraParceladaId: number | null;
}

/** Grupo de um mês na aba "Próximas contas", com o total do mês. */
export interface GrupoMesCalendario {
  chave: string;
  rotulo: string;
  total: number;
  itens: ItemCalendario[];
  // Quantos itens do mês estão vencidos e ainda pendentes - habilita a ação
  // "marcar mês como pago".
  pendentesVencidos: number;
}

/** "Setembro de 2026" a partir da chave "2026-09". */
export function rotuloMes(chave: string): string {
  const [ano, mes] = chave.split('-').map(Number);
  return `${MESES_NOMES[mes - 1]} de ${ano}`;
}

/** "05/09" a partir de "2026-09-05". */
export function formatarDiaMes(data: string): string {
  const [, mes, dia] = data.split('-');
  return `${dia}/${mes}`;
}

/**
 * Contas de recorrência/parcela na agenda "Próximas contas": os lançamentos
 * FUTUROS (data >= hoje) mais os PENDENTES já VENCIDOS (atrasados) - a agenda de
 * contas a pagar engloba o atraso, não só o que ainda vai vencer. Gastos já pagos
 * não entram (o dinheiro já saiu). Agrupados por mês em ordem cronológica, com o
 * total e a contagem de vencidos-pendentes de cada mês.
 */
export function agruparProximasContas(gastos: Gasto[], hoje: string): GrupoMesCalendario[] {
  const contas = gastos
    .filter((g) => g.gastoRecorrenteId != null || g.compraParceladaId != null)
    .filter((g) => {
      const status = statusDaConta(g, hoje);
      // futuras previstas (pendentes com vencimento pra frente) + atrasadas;
      // pagas ficam de fora.
      return status === 'PENDENTE' || status === 'ATRASADA';
    })
    .sort((a, b) => a.data.localeCompare(b.data));

  const grupos = new Map<string, GrupoMesCalendario>();
  for (const gasto of contas) {
    const chave = gasto.data.slice(0, 7);
    let grupo = grupos.get(chave);
    if (!grupo) {
      grupo = { chave, rotulo: rotuloMes(chave), total: 0, itens: [], pendentesVencidos: 0 };
      grupos.set(chave, grupo);
    }
    const status = statusDaConta(gasto, hoje);
    grupo.total += gasto.valor;
    if (status === 'ATRASADA') {
      grupo.pendentesVencidos++;
    }
    grupo.itens.push({
      id: gasto.id!,
      data: gasto.data,
      descricao: gasto.descricao,
      valor: gasto.valor,
      origem: gasto.compraParceladaId != null ? 'parcela' : 'recorrente',
      status,
      gastoRecorrenteId: gasto.gastoRecorrenteId ?? null,
      compraParceladaId: gasto.compraParceladaId ?? null
    });
  }
  return [...grupos.values()];
}
