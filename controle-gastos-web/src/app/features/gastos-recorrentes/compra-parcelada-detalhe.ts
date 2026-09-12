import { Gasto } from '../../models/gasto.model';

/**
 * Lógica pura do diálogo de detalhe de uma compra parcelada: decide se a lista de
 * parcelas deve ser agrupada por ano civil (parcelamentos longos, tipo 104x) ou
 * exibida como lista plana (curtos, tipo 3x/6x), e faz o agrupamento em si - sem
 * Angular, testável sem TestBed. O componente só chama estas funções.
 */

/** Um ano civil de parcelas, com total e se deve começar expandido no acordeão. */
export interface GrupoAnoParcelas {
  ano: number;
  total: number;
  quantidade: number;
  expandidoPadrao: boolean;
  parcelas: Gasto[];
}

/**
 * 12 é o mesmo teto de horizonte já usado em outros lugares do app (ex.:
 * mesesGerar de gastos recorrentes) - até esse tamanho, uma compra parcelada
 * cabe numa lista plana sem ficar longa demais; acima disso (o caso de uma
 * compra em 104x, ~8,6 anos) vale resumir por ano.
 */
export function deveAgruparPorAno(numeroParcelas: number): boolean {
  return numeroParcelas > 12;
}

/**
 * Agrupa as parcelas por ano civil (o ano da própria data da parcela), em ordem
 * cronológica. O ano que contém "hoje" começa expandido por padrão; se a compra
 * inteira já ficou no passado ou ainda nem começou, expande o ano mais próximo de
 * hoje (o mais recente ou o mais próximo no futuro) - nunca deixa tudo colapsado.
 */
export function agruparPorAno(parcelas: Gasto[], hoje: string): GrupoAnoParcelas[] {
  const anoHoje = Number(hoje.slice(0, 4));
  const grupos = new Map<number, GrupoAnoParcelas>();

  for (const parcela of parcelas) {
    const ano = Number(parcela.data.slice(0, 4));
    let grupo = grupos.get(ano);
    if (!grupo) {
      grupo = { ano, total: 0, quantidade: 0, expandidoPadrao: false, parcelas: [] };
      grupos.set(ano, grupo);
    }
    grupo.total += parcela.valor;
    grupo.quantidade++;
    grupo.parcelas.push(parcela);
  }

  const lista = [...grupos.values()].sort((a, b) => a.ano - b.ano);
  if (lista.length === 0) {
    return lista;
  }

  const grupoDoAnoCorrente = lista.find((g) => g.ano === anoHoje);
  const grupoParaExpandir = grupoDoAnoCorrente
    ?? (lista[lista.length - 1].ano < anoHoje ? lista[lista.length - 1] : lista[0]);
  grupoParaExpandir.expandidoPadrao = true;

  return lista;
}
