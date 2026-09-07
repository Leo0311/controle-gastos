import { Gasto } from '../../../models/gasto.model';
import {
  calcularSugestaoCategoria,
  combinarSugestoes,
  mesmaSugestao,
  normalizarDescricao,
  sugestaoDeveAparecer,
  SugestaoCategoria
} from './sugestao-categoria';

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

  describe('combinarSugestoes (plano A + plano B)', () => {
    it('histórico vazio: usa o dicionário sozinho (plano B)', () => {
      expect(combinarSugestoes(null, { categoriaId: 4, subcategoriaId: 9 }))
        .toEqual({ categoriaId: 4, subcategoriaId: 9 });
      expect(combinarSugestoes(null, null)).toBeNull();
    });

    it('cenário 1 - histórico com categoria E subcategoria: usa o histórico puro, ignora o dicionário', () => {
      // o dicionário aponta a mesma categoria com OUTRA subcategoria - não deve ser usado
      expect(combinarSugestoes({ categoriaId: 3, subcategoriaId: 7 }, { categoriaId: 3, subcategoriaId: 9 }))
        .toEqual({ categoriaId: 3, subcategoriaId: 7 });
    });

    it('cenário 2 - histórico só com categoria e dicionário concorda na categoria e tem subcategoria: completa com a sub do dicionário', () => {
      expect(combinarSugestoes({ categoriaId: 3, subcategoriaId: null }, { categoriaId: 3, subcategoriaId: 9 }))
        .toEqual({ categoriaId: 3, subcategoriaId: 9 });
    });

    it('cenário 3 - histórico só com categoria mas dicionário discorda da categoria: mantém o histórico sem subcategoria', () => {
      expect(combinarSugestoes({ categoriaId: 3, subcategoriaId: null }, { categoriaId: 4, subcategoriaId: 9 }))
        .toEqual({ categoriaId: 3, subcategoriaId: null });
    });

    it('cenário 3 - histórico só com categoria e dicionário sem entrada (null): mantém o histórico', () => {
      expect(combinarSugestoes({ categoriaId: 3, subcategoriaId: null }, null))
        .toEqual({ categoriaId: 3, subcategoriaId: null });
    });

    it('cenário 3 - histórico só com categoria e dicionário concorda mas também sem subcategoria: mantém o histórico', () => {
      expect(combinarSugestoes({ categoriaId: 3, subcategoriaId: null }, { categoriaId: 3, subcategoriaId: null }))
        .toEqual({ categoriaId: 3, subcategoriaId: null });
    });

    it('nunca troca a categoria do histórico pela do dicionário, mesmo o dicionário tendo subcategoria', () => {
      const r = combinarSugestoes({ categoriaId: 3, subcategoriaId: null }, { categoriaId: 8, subcategoriaId: 2 });
      expect(r?.categoriaId).toBe(3);
    });
  });

  describe('mesmaSugestao', () => {
    it('true só quando categoria e subcategoria batem (null-safe)', () => {
      expect(mesmaSugestao({ categoriaId: 3, subcategoriaId: 7 }, { categoriaId: 3, subcategoriaId: 7 })).toBeTrue();
      expect(mesmaSugestao({ categoriaId: 3, subcategoriaId: null }, { categoriaId: 3, subcategoriaId: null })).toBeTrue();
      expect(mesmaSugestao({ categoriaId: 3, subcategoriaId: 7 }, { categoriaId: 3, subcategoriaId: 8 })).toBeFalse();
      expect(mesmaSugestao({ categoriaId: 3, subcategoriaId: 7 }, { categoriaId: 4, subcategoriaId: 7 })).toBeFalse();
      expect(mesmaSugestao(null, null)).toBeTrue();
      expect(mesmaSugestao(null, { categoriaId: 3, subcategoriaId: 7 })).toBeFalse();
    });
  });

  describe('sugestaoDeveAparecer', () => {
    const sugComSub: SugestaoCategoria = { categoriaId: 3, subcategoriaId: 7 };
    const sugSoCategoria: SugestaoCategoria = { categoriaId: 3, subcategoriaId: null };

    it('não aparece sem sugestão ou quando dispensada', () => {
      expect(sugestaoDeveAparecer(null, false, null, null)).toBeFalse();
      expect(sugestaoDeveAparecer(sugComSub, true, null, null)).toBeFalse();
    });

    it('aparece enquanto nada foi escolhido', () => {
      expect(sugestaoDeveAparecer(sugComSub, false, null, null)).toBeTrue();
    });

    it('some assim que o usuário escolhe QUALQUER subcategoria (bug 1)', () => {
      // subcategoria sugerida
      expect(sugestaoDeveAparecer(sugComSub, false, 3, 7)).toBeFalse();
      // subcategoria diferente, mesma categoria
      expect(sugestaoDeveAparecer(sugComSub, false, 3, 9)).toBeFalse();
      // subcategoria escolhida sobre uma sugestão categoria-só
      expect(sugestaoDeveAparecer(sugSoCategoria, false, 3, 9)).toBeFalse();
    });

    it('sugestão categoria-só some quando essa categoria já está aplicada', () => {
      expect(sugestaoDeveAparecer(sugSoCategoria, false, 3, null)).toBeFalse();
    });

    it('continua visível quando só a categoria mudou, sem subcategoria (atalho de correção)', () => {
      // categoria diferente da sugerida, sem subcategoria ainda
      expect(sugestaoDeveAparecer(sugComSub, false, 5, null)).toBeTrue();
      expect(sugestaoDeveAparecer(sugSoCategoria, false, 5, null)).toBeTrue();
      // categoria da sugestão-com-subcategoria escolhida, subcategoria ainda não
      expect(sugestaoDeveAparecer(sugComSub, false, 3, null)).toBeTrue();
    });
  });
});
