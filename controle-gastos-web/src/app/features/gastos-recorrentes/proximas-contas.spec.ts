import { Gasto } from '../../models/gasto.model';
import {
  agruparProximasContas,
  formatarDiaMes,
  hojeIso,
  rotuloMes
} from './proximas-contas';

let proximoId = 1;

function gasto(parcial: Partial<Gasto>): Gasto {
  const data = parcial.data ?? '2026-09-10';
  return {
    id: proximoId++,
    descricao: 'Gasto',
    valor: 10,
    categoriaId: 1,
    data,
    // Uma "conta" da agenda é, por padrão, um lançamento de recorrência ainda
    // não pago, com vencimento na própria data.
    gastoRecorrenteId: 1,
    statusPagamento: 'PENDENTE',
    vencimentoOriginal: data,
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

    it('ignora gastos avulsos e gastos já pagos; inclui pendentes (futuros e vencidos)', () => {
      const gastos = [
        gasto({ data: '2026-08-20', vencimentoOriginal: '2026-08-20' }),         // pendente vencido -> entra
        gasto({ data: '2026-09-10', gastoRecorrenteId: null, compraParceladaId: null }), // avulso -> fora
        gasto({ data: '2026-09-15', statusPagamento: 'PAGO' }),                  // pago -> fora
        gasto({ data: '2026-09-20' })                                           // pendente futuro -> entra
      ];

      const grupos = agruparProximasContas(gastos, hoje);

      expect(grupos.map((g) => g.chave)).toEqual(['2026-08', '2026-09']);
      expect(grupos[0].itens[0].status).toBe('ATRASADA');
      expect(grupos[1].itens.map((i) => i.descricao)).toEqual(['Gasto']);
      expect(grupos[1].itens[0].status).toBe('PENDENTE');
    });

    it('conta pendentesVencidos por mês', () => {
      const gastos = [
        gasto({ data: '2026-08-10', vencimentoOriginal: '2026-08-10' }),
        gasto({ data: '2026-08-25', vencimentoOriginal: '2026-08-25' }),
        gasto({ data: '2026-09-20' })
      ];

      const grupos = agruparProximasContas(gastos, hoje);

      expect(grupos[0].pendentesVencidos).toBe(2);
      expect(grupos[1].pendentesVencidos).toBe(0);
    });

    it('agrupa por mês em ordem cronológica, com total e rótulo do mês', () => {
      const gastos = [
        gasto({ data: '2026-10-05', valor: 100, compraParceladaId: 2 }),
        gasto({ data: '2026-09-20', valor: 30 }),
        gasto({ data: '2026-09-05', valor: 20 })
      ];

      const grupos = agruparProximasContas(gastos, hoje);

      expect(grupos.map((g) => g.chave)).toEqual(['2026-09', '2026-10']);
      expect(grupos[0].rotulo).toBe('Setembro de 2026');
      expect(grupos[0].total).toBe(50);
      expect(grupos[0].itens.map((i) => i.data)).toEqual(['2026-09-05', '2026-09-20']);
      expect(grupos[1].total).toBe(100);
    });

    it('marca a origem e propaga os ids de origem', () => {
      const gastos = [
        gasto({ data: '2026-09-05', compraParceladaId: 9, gastoRecorrenteId: null }),
        gasto({ data: '2026-09-06', compraParceladaId: null, gastoRecorrenteId: 4 })
      ];

      const [grupo] = agruparProximasContas(gastos, hoje);

      expect(grupo.itens[0].origem).toBe('parcela');
      expect(grupo.itens[0].compraParceladaId).toBe(9);
      expect(grupo.itens[1].origem).toBe('recorrente');
      expect(grupo.itens[1].gastoRecorrenteId).toBe(4);
    });

    it('devolve lista vazia quando não há conta pendente', () => {
      expect(agruparProximasContas([], hoje)).toEqual([]);
      expect(agruparProximasContas([gasto({ statusPagamento: 'PAGO' })], hoje)).toEqual([]);
    });
  });
});
