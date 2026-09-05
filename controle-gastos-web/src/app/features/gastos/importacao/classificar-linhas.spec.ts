import { Gasto } from '../../../models/gasto.model';
import { LinhaImportacao } from '../../../core/xlsx-importer';
import { classificarLinhas, gastoMudou } from './classificar-linhas';

function gasto(over: Partial<Gasto> = {}): Gasto {
  return {
    id: 1,
    descricao: 'Mercado',
    valor: 300,
    categoriaId: 5,
    categoria: 'Alimentação',
    subcategoria: null,
    data: '2026-09-05',
    ...over
  };
}

function linha(over: Partial<LinhaImportacao> = {}): LinhaImportacao {
  return {
    linha: 2,
    id: null,
    descricao: 'Mercado',
    categoria: 'Alimentação',
    subcategoria: null,
    valorExibicao: '300,00',
    valor: 300,
    dataExibicao: '05/09/2026',
    data: '2026-09-05',
    valido: true,
    erro: null,
    ...over
  };
}

describe('classificar-linhas', () => {

  describe('gastoMudou', () => {
    it('é falso quando descrição, valor, categoria, subcategoria e data batem', () => {
      expect(gastoMudou(gasto(), linha())).toBe(false);
    });

    it('tolera diferença de até 1 milésimo no valor', () => {
      expect(gastoMudou(gasto({ valor: 300 }), linha({ valor: 300.0009 }))).toBe(false);
      expect(gastoMudou(gasto({ valor: 300 }), linha({ valor: 300.01 }))).toBe(true);
    });

    it('detecta mudança de categoria ignorando maiúsculas', () => {
      expect(gastoMudou(gasto({ categoria: 'Alimentação' }), linha({ categoria: 'ALIMENTAÇÃO' }))).toBe(false);
      expect(gastoMudou(gasto({ categoria: 'Alimentação' }), linha({ categoria: 'Transporte' }))).toBe(true);
    });

    it('trata subcategoria nula e string vazia como iguais', () => {
      expect(gastoMudou(gasto({ subcategoria: null }), linha({ subcategoria: null }))).toBe(false);
      expect(gastoMudou(gasto({ subcategoria: 'Mercado' }), linha({ subcategoria: null }))).toBe(true);
    });

    it('detecta mudança de data e de descrição', () => {
      expect(gastoMudou(gasto(), linha({ data: '2026-09-06' }))).toBe(true);
      expect(gastoMudou(gasto(), linha({ descricao: 'Mercado grande' }))).toBe(true);
    });

    it('trata valor nulo da linha como zero', () => {
      expect(gastoMudou(gasto({ valor: 300 }), linha({ valor: null }))).toBe(true);
      expect(gastoMudou(gasto({ valor: 0.0005 }), linha({ valor: null }))).toBe(false);
    });
  });

  describe('classificarLinhas', () => {
    const existentes = [
      gasto({ id: 10, descricao: 'Aluguel', valor: 1500, categoria: 'Moradia', data: '2026-09-01' }),
      gasto({ id: 20, descricao: 'Mercado', valor: 300, categoria: 'Alimentação', data: '2026-09-05' }),
      gasto({ id: 30, descricao: 'Uber', valor: 25, categoria: 'Transporte', data: '2026-09-10' })
    ];

    it('linha idêntica a um gasto existente conta como jaCadastradas e não entra em nenhum balde', () => {
      const r = classificarLinhas(
        [linha({ descricao: 'Aluguel', valor: 1500, categoria: 'Moradia', data: '2026-09-01' })],
        existentes
      );
      expect(r.jaCadastradas).toBe(1);
      expect(r.linhasNovas).toEqual([]);
      expect(r.atualizacoes).toEqual([]);
    });

    it('linha com ID que casa e algum campo diferente vira atualização', () => {
      const l = linha({ id: 30, descricao: 'Uber', valor: 30, categoria: 'Transporte', data: '2026-09-10' });
      const r = classificarLinhas([l], existentes);
      expect(r.atualizacoes.length).toBe(1);
      expect(r.atualizacoes[0].existente.id).toBe(30);
      expect(r.atualizacoes[0].linha).toBe(l);
    });

    it('linha com ID que não corresponde a nenhum gasto atual vira suspeita', () => {
      const l = linha({ id: 999999, descricao: 'Dívida antiga', valor: 800, categoria: 'Saúde', data: '2025-01-01' });
      const r = classificarLinhas([l], existentes);
      expect(r.linhasSuspeitas).toEqual([l]);
      expect(r.linhasNovas).toEqual([]);
    });

    it('linha sem ID com descrição+categoria iguais a um gasto mas valor diferente vira possível edição', () => {
      const l = linha({ id: null, descricao: 'Mercado', valor: 350, categoria: 'Alimentação', data: '2026-09-05' });
      const r = classificarLinhas([l], existentes);
      expect(r.linhasPossivelEdicao).toEqual([l]);
      expect(r.linhasNovas).toEqual([]);
    });

    it('linha sem ID que não parece nenhum gasto existente vira nova', () => {
      const l = linha({ id: null, descricao: 'Ração do cão', valor: 90, categoria: 'Pets', data: '2026-09-15' });
      const r = classificarLinhas([l], existentes);
      expect(r.linhasNovas).toEqual([l]);
      expect(r.linhasPossivelEdicao).toEqual([]);
    });

    it('descrição igual mas categoria diferente NÃO é possível edição (é nova)', () => {
      const l = linha({ id: null, descricao: 'Mercado', valor: 350, categoria: 'Lazer', data: '2026-09-05' });
      const r = classificarLinhas([l], existentes);
      expect(r.linhasNovas).toEqual([l]);
      expect(r.linhasPossivelEdicao).toEqual([]);
    });

    it('classifica uma planilha mista em uma passada', () => {
      const r = classificarLinhas([
        linha({ id: null, descricao: 'Ração do cão', valor: 90, categoria: 'Pets', data: '2026-09-15' }),
        linha({ id: 999999, descricao: 'Dívida antiga', valor: 800, categoria: 'Saúde', data: '2025-01-01' }),
        linha({ id: null, descricao: 'Mercado', valor: 350, categoria: 'Alimentação', data: '2026-09-05' }),
        linha({ id: 30, descricao: 'Uber', valor: 30, categoria: 'Transporte', data: '2026-09-10' }),
        linha({ id: 10, descricao: 'Aluguel', valor: 1500, categoria: 'Moradia', data: '2026-09-01' })
      ], existentes);

      expect(r.linhasNovas.map((l) => l.descricao)).toEqual(['Ração do cão']);
      expect(r.linhasSuspeitas.map((l) => l.descricao)).toEqual(['Dívida antiga']);
      expect(r.linhasPossivelEdicao.map((l) => l.descricao)).toEqual(['Mercado']);
      expect(r.atualizacoes.map((a) => a.existente.id)).toEqual([30]);
      expect(r.jaCadastradas).toBe(1);
    });
  });
});
