import { Gasto } from '../../models/gasto.model';

/**
 * Lógica pura do diálogo de detalhe de uma compra parcelada: decide se a lista de
 * parcelas deve ser agrupada por ano civil (parcelamentos longos, tipo 104x) ou
 * exibida como lista plana (curtos, tipo 3x/6x), e monta os buckets do agrupamento -
 * sem Angular, testável sem TestBed. O componente só chama estas funções.
 */

/** Um ano civil (o atual ou o seguinte) com o mês a mês detalhado. */
export interface GrupoAnoDetalhado {
  tipo: 'ano';
  ano: number;
  total: number;
  quantidade: number;
  expandidoPadrao: boolean;
  parcelas: Gasto[];
}

/**
 * Tudo a partir de 2 anos à frente de hoje, consolidado numa linha só (sem
 * drill-down mês a mês - ver rec do diálogo). `anos`/`meses` são a DURAÇÃO restante
 * (quantidade de parcelas ÷ 12), não a contagem de anos-calendário distintos - cada
 * parcela é exatamente 1 mês e são consecutivas (gerarParcelas no backend garante
 * isso), então não tem "meio de ano" a considerar: é só dividir a contagem.
 */
export interface GrupoRestante {
  tipo: 'restante';
  anos: number;
  meses: number;
  quantidade: number;
  total: number;
}

export type GrupoParcelas = GrupoAnoDetalhado | GrupoRestante;

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
 * Separa as parcelas em até 3 buckets fixos, ancorados em "hoje" (não mais um
 * grupo por ano encontrado): ano atual (mês a mês, expandido por padrão), ano
 * seguinte (mês a mês, colapsado) e o resto (consolidado, sem detalhe). Um bucket
 * só aparece se tiver pelo menos 1 parcela - nunca renderiza vazio.
 *
 * Se o bucket do ano atual não existir (a 1ª parcela da compra só cai no ano
 * seguinte), o ano seguinte assume o `expandidoPadrao` - sempre exatamente 1
 * bucket tipo 'ano' expandido, quando existir ao menos um.
 *
 * Parcela com ano anterior ao de hoje (passado "profundo") cai no bucket do ano
 * atual por segurança - teórico, não alcançável via formulário real: a validação
 * de cadastro (`CompraParceladaService`, 1ª parcela no máx. 12 meses atrás) torna
 * isso estruturalmente impossível para uma compra com mais de 12 parcelas.
 */
export function agruparPorAno(parcelas: Gasto[], hoje: string): GrupoParcelas[] {
  const anoHoje = Number(hoje.slice(0, 4));

  const doAnoAtual: Gasto[] = [];
  const doAnoSeguinte: Gasto[] = [];
  const doResto: Gasto[] = [];

  for (const parcela of parcelas) {
    const ano = Number(parcela.data.slice(0, 4));
    if (ano <= anoHoje) {
      doAnoAtual.push(parcela);
    } else if (ano === anoHoje + 1) {
      doAnoSeguinte.push(parcela);
    } else {
      doResto.push(parcela);
    }
  }

  const grupos: GrupoParcelas[] = [];

  if (doAnoAtual.length > 0) {
    grupos.push(montarGrupoAno(anoHoje, doAnoAtual, true));
  }
  if (doAnoSeguinte.length > 0) {
    grupos.push(montarGrupoAno(anoHoje + 1, doAnoSeguinte, doAnoAtual.length === 0));
  }
  if (doResto.length > 0) {
    grupos.push(montarGrupoRestante(doResto));
  }

  return grupos;
}

function somar(parcelas: Gasto[]): number {
  return parcelas.reduce((soma, p) => soma + p.valor, 0);
}

function montarGrupoAno(ano: number, parcelas: Gasto[], expandidoPadrao: boolean): GrupoAnoDetalhado {
  return { tipo: 'ano', ano, total: somar(parcelas), quantidade: parcelas.length, expandidoPadrao, parcelas };
}

function montarGrupoRestante(parcelas: Gasto[]): GrupoRestante {
  const totalMeses = parcelas.length;
  return {
    tipo: 'restante',
    anos: Math.floor(totalMeses / 12),
    meses: totalMeses % 12,
    quantidade: parcelas.length,
    total: somar(parcelas)
  };
}
