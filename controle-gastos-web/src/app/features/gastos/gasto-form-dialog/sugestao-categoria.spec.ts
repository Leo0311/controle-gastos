import { Gasto } from '../../../models/gasto.model';
import { calcularSugestaoCategoria, normalizarDescricao } from './sugestao-categoria';

function gasto(descricao: string, categoriaId: number, subcategoriaId: number | null, data = '2026-01-01'): Gasto {
  return { descricao, valor: 10, categoriaId, subcategoriaId, data };
}

describe('sugestao-categoria', () => {
  describe('normalizarDescricao', () => {
    it('remove acento, espaços das pontas e caixa', () => {
      expect(normalizarDescricao('  Açaí da Praça  ')).toBe('acai da praca');
    });
  });

  describe('calcularSugestaoCategoria', () => {
    it('devolve null com menos de 3 caracteres', () => {
      expect(calcularSugestaoCategoria('Ub', [gasto('Uber trabalho', 3, 7)])).toBeNull();
    });

    it('devolve null quando não há descrição parecida', () => {
      const historico = [gasto('Mercado', 1, null), gasto('Farmácia', 2, null)];
      expect(calcularSugestaoCategoria('Uber', historico)).toBeNull();
    });

    it('sugere a combinação categoria+subcategoria mais frequente entre os parecidos', () => {
      const historico = [
        gasto('Uber trabalho', 3, 7),
        gasto('Uber casa', 3, 7),
        gasto('Uber aeroporto', 3, 9)
      ];
      expect(calcularSugestaoCategoria('uber', historico)).toEqual({ categoriaId: 3, subcategoriaId: 7 });
    });

    it('casa quando o texto digitado contém uma descrição anterior e ignora gastos sem categoria', () => {
      const historico = [
        { descricao: 'Uber', valor: 5, categoriaId: null as unknown as number, subcategoriaId: null, data: '2026-02-01' },
        gasto('Uber trabalho', 3, 7, '2026-02-02')
      ];
      expect(calcularSugestaoCategoria('Uber trabalho de manhã', historico)).toEqual({ categoriaId: 3, subcategoriaId: 7 });
    });

    it('no empate, vence a combinação do gasto mais recente', () => {
      const historico = [
        gasto('Uber A', 3, 7, '2026-01-10'),
        gasto('Uber B', 4, 8, '2026-05-20')
      ];
      expect(calcularSugestaoCategoria('uber', historico)).toEqual({ categoriaId: 4, subcategoriaId: 8 });
    });
  });
});
