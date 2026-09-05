/**
 * Texto do diálogo de confirmação ao pausar uma recorrência (achado M8, extraído
 * de gastos-recorrentes.component.ts). Pausar só impede novos lançamentos; os já
 * pré-gerados (data >= hoje) continuam valendo nas outras telas, e o texto muda
 * conforme quantos são (nenhum / um / vários). Pura, testável sem TestBed.
 */
export function mensagemPausaRecorrente(descricao: string, lancamentosFuturos: number): string {
  const consequencia = lancamentosFuturos === 0
    ? 'Nenhum lançamento futuro foi pré-gerado ainda, então nada muda nas outras telas. Para encerrar de '
      + 'vez, use Excluir (que mantém o histórico dos meses passados).'
    : (lancamentosFuturos === 1
        ? 'Há 1 lançamento futuro já gerado (de hoje em diante) que continua'
        : `Há ${lancamentosFuturos} lançamentos futuros já gerados (de hoje em diante) que continuam`)
      + ' na lista de Gastos, no Dashboard e em "Próximas contas" - pausar não remove '
      + (lancamentosFuturos === 1 ? 'esse lançamento' : 'nenhum deles')
      + '. Para remover também os lançamentos futuros, use Excluir, que apaga os lançamentos a partir de hoje '
      + 'e mantém o histórico dos meses passados.';
  return `Pausar "${descricao}" só impede a geração de NOVOS lançamentos daqui pra frente. ` + consequencia;
}
