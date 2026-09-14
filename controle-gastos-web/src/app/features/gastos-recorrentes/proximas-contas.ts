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

/** Próxima chave "yyyy-MM" depois de "chave" (rolagem de ano em dezembro→janeiro). */
function proximaChave(chave: string): string {
  const [ano, mes] = chave.split('-').map(Number);
  const mesSeguinte = mes === 12 ? 1 : mes + 1;
  const anoSeguinte = mes === 12 ? ano + 1 : ano;
  return `${anoSeguinte}-${String(mesSeguinte).padStart(2, '0')}`;
}

/**
 * Contas de recorrência/parcela na agenda "Próximas contas": os lançamentos
 * FUTUROS (data >= hoje) mais os PENDENTES já VENCIDOS (atrasados) - a agenda de
 * contas a pagar engloba o atraso, não só o que ainda vai vencer. Gastos já pagos
 * não entram (o dinheiro já saiu). Agrupados por mês em ordem cronológica, com o
 * total e a contagem de vencidos-pendentes de cada mês.
 *
 * `meses` é a mesma janela de calendário fixo que o backend já usa pra montar
 * `fimHorizonte` (GastoService.proximasContas: mês corrente + meses-1 seguintes) -
 * os grupos desses `meses` meses são pré-semeados vazios ANTES de popular com as
 * contas recebidas, então um mês sem nenhuma pendência continua aparecendo no
 * resultado (com `itens: []`), em vez de simplesmente não existir. Achado de
 * auditoria 2026-09-14: antes, pagar a única conta pendente de um mês fazia esse
 * mês sumir inteiro da janela, mesmo com meses seguintes ainda presentes - "3
 * meses" virava "2 meses" sem aviso. Um mês ATRASADO anterior à janela (ex: uma
 * conta de agosto vista com o mês corrente já em setembro) continua ganhando
 * grupo próprio via o fallback de criação abaixo, exatamente como antes.
 */
export function agruparProximasContas(gastos: Gasto[], hoje: string, meses: number): GrupoMesCalendario[] {
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
  let chaveJanela = hoje.slice(0, 7);
  for (let i = 0; i < meses; i++) {
    grupos.set(chaveJanela, { chave: chaveJanela, rotulo: rotuloMes(chaveJanela), total: 0, itens: [], pendentesVencidos: 0 });
    chaveJanela = proximaChave(chaveJanela);
  }

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
  // Pré-semeadura insere os meses da janela antes dos atrasados de meses
  // anteriores serem descobertos no laço acima - reordena por chave pra garantir
  // cronologia independente da ordem de inserção no Map.
  return [...grupos.values()].sort((a, b) => a.chave.localeCompare(b.chave));
}

/**
 * true se algum grupo da agenda tem pelo menos um item - usado pelo empty-state
 * global da tela pra distinguir "nada cadastrado nessa janela" (mostra o
 * empty-state) de "existem meses vazios misturados com meses de conteúdo" (mostra
 * a lista normalmente, com os meses vazios indicando "nada pendente").
 */
export function agendaTemAlgumItem(grupos: GrupoMesCalendario[]): boolean {
  return grupos.some((g) => g.itens.length > 0);
}
