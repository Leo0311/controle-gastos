import { Gasto } from '../../models/gasto.model';
import { MESES_NOMES } from '../../core/meses';

/**
 * Lógica pura da aba "Próximas contas" (achado M8): agrupamento dos lançamentos
 * futuros por mês e contagem por recorrência, sem Angular, testável sem TestBed.
 * O componente `proximas-contas.component.ts` só chama estas funções e cuida da
 * janela de meses visíveis; o carregamento dos gastos fica no componente pai.
 */

/** Um lançamento futuro (recorrente ou parcela) na aba "Próximas contas". */
export interface ItemCalendario {
  data: string;
  descricao: string;
  valor: number;
  origem: 'recorrente' | 'parcela';
}

/** Grupo de um mês na aba "Próximas contas", com o total do mês. */
export interface GrupoMesCalendario {
  chave: string;
  rotulo: string;
  total: number;
  itens: ItemCalendario[];
}

/** Data de hoje em ISO (yyyy-MM-dd), no fuso local. */
export function hojeIso(hoje: Date = new Date()): string {
  const ano = hoje.getFullYear();
  const mes = String(hoje.getMonth() + 1).padStart(2, '0');
  const dia = String(hoje.getDate()).padStart(2, '0');
  return `${ano}-${mes}-${dia}`;
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
 * Gastos futuros (data >= hoje) que vieram de uma recorrência ou de uma compra
 * parcelada, agrupados por mês em ordem cronológica, com o total de cada mês.
 */
export function agruparProximasContas(gastos: Gasto[], hoje: string): GrupoMesCalendario[] {
  const futuros = gastos
    .filter((g) => g.data >= hoje && (g.gastoRecorrenteId != null || g.compraParceladaId != null))
    .sort((a, b) => a.data.localeCompare(b.data));

  const grupos = new Map<string, GrupoMesCalendario>();
  for (const gasto of futuros) {
    const chave = gasto.data.slice(0, 7);
    let grupo = grupos.get(chave);
    if (!grupo) {
      grupo = { chave, rotulo: rotuloMes(chave), total: 0, itens: [] };
      grupos.set(chave, grupo);
    }
    grupo.total += gasto.valor;
    grupo.itens.push({
      data: gasto.data,
      descricao: gasto.descricao,
      valor: gasto.valor,
      origem: gasto.compraParceladaId != null ? 'parcela' : 'recorrente'
    });
  }
  return [...grupos.values()];
}

/**
 * Conta, por recorrência, os gastos com data >= hoje já vinculados a ela (os
 * pré-gerados pelo horizonte "gerar próximos meses"). Reusa a lista de gastos que
 * a aba "Próximas contas" já baixa - sem request novo.
 */
export function contarLancamentosFuturosPorRecorrente(gastos: Gasto[], hoje: string): Map<number, number> {
  const mapa = new Map<number, number>();
  for (const gasto of gastos) {
    if (gasto.gastoRecorrenteId != null && gasto.data >= hoje) {
      mapa.set(gasto.gastoRecorrenteId, (mapa.get(gasto.gastoRecorrenteId) ?? 0) + 1);
    }
  }
  return mapa;
}
