import * as XLSX from 'xlsx-js-style';

import { neutralizarFormula, sanitizarLinhas } from './xlsx-sanitizacao';

describe('xlsx-sanitizacao', () => {
  describe('neutralizarFormula', () => {
    it('prefixa com apóstrofo textos que começam com =, +, -, @ ou tab', () => {
      expect(neutralizarFormula('=HYPERLINK("http://exemplo.com")')).toBe(
        '\'=HYPERLINK("http://exemplo.com")'
      );
      expect(neutralizarFormula('+1234')).toBe("'+1234");
      expect(neutralizarFormula('-cmd')).toBe("'-cmd");
      expect(neutralizarFormula('@SUM(A1)')).toBe("'@SUM(A1)");
      expect(neutralizarFormula('\tinjecao')).toBe("'\tinjecao");
    });

    it('não altera texto comum, string vazia ou valores não-string', () => {
      expect(neutralizarFormula('Almoço no restaurante')).toBe('Almoço no restaurante');
      expect(neutralizarFormula('Conta de -50% (promo)')).toBe('Conta de -50% (promo)');
      expect(neutralizarFormula('')).toBe('');
      expect(neutralizarFormula(45.9)).toBe(45.9);
      expect(neutralizarFormula(null)).toBeNull();
      expect(neutralizarFormula(undefined)).toBeUndefined();
    });
  });

  describe('sanitizarLinhas', () => {
    it('trata cada célula da matriz e preserva a forma', () => {
      const entrada = [
        ['ID', 'Descrição', 'Valor'],
        [1, '=1+1', 10],
        [2, 'Padaria', 3.5]
      ];
      expect(sanitizarLinhas(entrada)).toEqual([
        ['ID', 'Descrição', 'Valor'],
        [1, "'=1+1", 10],
        [2, 'Padaria', 3.5]
      ]);
    });
  });

  it('a planilha gerada guarda o payload como texto, não como fórmula', () => {
    const descricao = '=HYPERLINK("http://exemplo.com")';
    const linhas = sanitizarLinhas([
      ['ID', 'Descrição', 'Valor'],
      [1, descricao, 10]
    ]);

    const planilha = XLSX.utils.aoa_to_sheet(linhas);
    const celula = planilha['B2'];

    expect(celula.t).toBe('s'); // string, não 'n'/fórmula
    expect(celula.f).toBeUndefined(); // sem fórmula associada
    expect(celula.v).toBe(`'${descricao}`);
  });
});
