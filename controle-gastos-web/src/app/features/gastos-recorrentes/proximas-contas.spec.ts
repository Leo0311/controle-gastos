import { Gasto } from '../../models/gasto.model';
import {
  agruparProximasContas,
  contarLancamentosFuturosPorRecorrente,
  formatarDiaMes,
  hojeIso,
  rotuloMes
} from './proximas-contas';

function gasto(parcial: Partial<Gasto>): Gasto {
  return {
    descricao: 'Gasto',
    valor: 10,
    categoriaId: 1,
    data: '2026-09-10',
    ...parcial
  };
}

describe('proximas-contas (lógica pura da aba)', () => {

  describe('hojeIso', () => {
    it('formata a data recebida como yyyy-MM-dd no fuso local', () => {
      expect(hojeIso(new Date(2026, 0, 5))).toBe('2026-01-05');
      expect(hojeIso(new Date(2026, 11, 31))).toBe('2026-12-31');
    });
  });

  describe('rotuloMes', () => {
    it('monta "Mês de ano" a partir da chave yyyy-MM', () => {
      expect(rotuloMes('2026-09')).toBe('Setembro de 2026');
      expect(rotuloMes('2027-01')).toBe('Janeiro de 2027');
    });
  });

  describe('formatarDiaMes', () => {
    it('vira dd/MM', () => {
      expect(formatarDiaMes('2026-09-05')).toBe('05/09');
    });
  });

  describe('agruparProximasContas', () => {
    const hoje = '2026-09-01';

    it('ignora gastos anteriores a hoje e gastos avulsos (sem recorrência/parcela)', () => {
      const gastos = [
        gasto({ data: '2026-08-31', gastoRecorrenteId: 1 }),          // passado
        gasto({ data: '2026-09-10', gastoRecorrenteId: null, compraParceladaId: null }), // avulso
        gasto({ data: '2026-09-15', gastoRecorrenteId: 7 })           // conta
      ];

      const grupos = agruparProximasContas(gastos, hoje);

      expect(grupos.length).toBe(1);
      expect(grupos[0].itens.length).toBe(1);
      expect(grupos[0].itens[0].descricao).toBe('Gasto');
    });

    it('inclui o gasto exatamente na data de hoje', () => {
      const grupos = agruparProximasContas([gasto({ data: hoje, compraParceladaId: 3 })], hoje);
      expect(grupos[0].itens.length).toBe(1);
    });

    it('agrupa por mês em ordem cronológica, com total e rótulo do mês', () => {
      const gastos = [
        gasto({ data: '2026-10-05', valor: 100, compraParceladaId: 2 }),
        gasto({ data: '2026-09-20', valor: 30, gastoRecorrenteId: 1 }),
        gasto({ data: '2026-09-05', valor: 20, gastoRecorrenteId: 1 })
      ];

      const grupos = agruparProximasContas(gastos, hoje);

      expect(grupos.map((g) => g.chave)).toEqual(['2026-09', '2026-10']);
      expect(grupos[0].rotulo).toBe('Setembro de 2026');
      expect(grupos[0].total).toBe(50);
      expect(grupos[0].itens.map((i) => i.data)).toEqual(['2026-09-05', '2026-09-20']);
      expect(grupos[1].total).toBe(100);
    });

    it('marca a origem: parcela quando há compraParceladaId, recorrente caso contrário', () => {
      const gastos = [
        gasto({ data: '2026-09-05', compraParceladaId: 9, gastoRecorrenteId: null }),
        gasto({ data: '2026-09-06', compraParceladaId: null, gastoRecorrenteId: 4 })
      ];

      const [grupo] = agruparProximasContas(gastos, hoje);

      expect(grupo.itens[0].origem).toBe('parcela');
      expect(grupo.itens[1].origem).toBe('recorrente');
    });

    it('devolve lista vazia quando não há nada futuro', () => {
      expect(agruparProximasContas([], hoje)).toEqual([]);
    });
  });

  describe('contarLancamentosFuturosPorRecorrente', () => {
    const hoje = '2026-09-01';

    it('conta só gastos com data >= hoje vinculados a uma recorrência, por id', () => {
      const gastos = [
        gasto({ data: '2026-09-10', gastoRecorrenteId: 1 }),
        gasto({ data: '2026-10-10', gastoRecorrenteId: 1 }),
        gasto({ data: '2026-08-10', gastoRecorrenteId: 1 }),   // passado - fora
        gasto({ data: '2026-09-10', gastoRecorrenteId: 2 }),
        gasto({ data: '2026-09-10', compraParceladaId: 5, gastoRecorrenteId: null }) // parcela - fora
      ];

      const mapa = contarLancamentosFuturosPorRecorrente(gastos, hoje);

      expect(mapa.get(1)).toBe(2);
      expect(mapa.get(2)).toBe(1);
      expect(mapa.has(5)).toBe(false);
    });

    it('devolve mapa vazio quando não há lançamentos futuros de recorrência', () => {
      expect(contarLancamentosFuturosPorRecorrente([], hoje).size).toBe(0);
    });
  });
});
