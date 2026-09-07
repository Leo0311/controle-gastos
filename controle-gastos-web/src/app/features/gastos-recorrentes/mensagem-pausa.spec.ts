import { mensagemPausaRecorrente } from './mensagem-pausa';

describe('mensagemPausaRecorrente', () => {

  it('sempre começa explicando que pausar só impede novos lançamentos', () => {
    expect(mensagemPausaRecorrente('Netflix', 0))
      .toContain('Pausar "Netflix" só impede a geração de NOVOS lançamentos daqui pra frente.');
  });

  it('sem lançamentos futuros: diz que nada muda nas outras telas', () => {
    const msg = mensagemPausaRecorrente('Netflix', 0);
    expect(msg).toContain('Nenhum lançamento futuro foi pré-gerado ainda');
    expect(msg).not.toContain('continua');
  });

  it('descreve Excluir como remoção total (passados e futuros), não parcial', () => {
    // Desde a exclusão em cascata (7b5ba9e), Excluir apaga TODOS os lançamentos e a
    // recorrência. O texto não pode mais prometer que "mantém o histórico dos meses passados".
    for (const n of [0, 1, 3]) {
      const msg = mensagemPausaRecorrente('Netflix', n);
      expect(msg).toContain('passados e futuros');
      expect(msg).not.toContain('histórico dos meses passados');
    }
  });

  it('um lançamento futuro: texto no singular ("1 lançamento", "esse lançamento")', () => {
    const msg = mensagemPausaRecorrente('Netflix', 1);
    expect(msg).toContain('Há 1 lançamento futuro já gerado (de hoje em diante) que continua');
    expect(msg).toContain('pausar não remove esse lançamento');
  });

  it('vários lançamentos futuros: texto no plural com a contagem', () => {
    const msg = mensagemPausaRecorrente('Netflix', 3);
    expect(msg).toContain('Há 3 lançamentos futuros já gerados (de hoje em diante) que continuam');
    expect(msg).toContain('pausar não remove nenhum deles');
  });
});
