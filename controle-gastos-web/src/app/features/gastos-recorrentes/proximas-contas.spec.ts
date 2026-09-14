import { Gasto } from '../../models/gasto.model';
import {
  agendaTemAlgumItem,
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

      const grupos = agruparProximasContas(gastos, hoje, 1);

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

      const grupos = agruparProximasContas(gastos, hoje, 1);

      expect(grupos[0].pendentesVencidos).toBe(2);
      expect(grupos[1].pendentesVencidos).toBe(0);
    });

    it('agrupa por mês em ordem cronológica, com total e rótulo do mês', () => {
      const gastos = [
        gasto({ data: '2026-10-05', valor: 100, compraParceladaId: 2 }),
        gasto({ data: '2026-09-20', valor: 30 }),
        gasto({ data: '2026-09-05', valor: 20 })
      ];

      const grupos = agruparProximasContas(gastos, hoje, 1);

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

      const [grupo] = agruparProximasContas(gastos, hoje, 1);

      expect(grupo.itens[0].origem).toBe('parcela');
      expect(grupo.itens[0].compraParceladaId).toBe(9);
      expect(grupo.itens[1].origem).toBe('recorrente');
      expect(grupo.itens[1].gastoRecorrenteId).toBe(4);
    });

    it('pré-semeia o mês da janela mesmo sem nenhuma conta pendente nele', () => {
      expect(agruparProximasContas([], hoje, 1)).toEqual([
        { chave: '2026-09', rotulo: 'Setembro de 2026', total: 0, itens: [], pendentesVencidos: 0 }
      ]);
      expect(agruparProximasContas([gasto({ statusPagamento: 'PAGO' })], hoje, 1)).toEqual([
        { chave: '2026-09', rotulo: 'Setembro de 2026', total: 0, itens: [], pendentesVencidos: 0 }
      ]);
    });

    // Achado de auditoria 2026-09-14: pagar a única conta pendente de um mês não
    // deve mais fazer esse mês sumir da janela quando ele tem meses seguintes -
    // "3 meses" tem que continuar mostrando 3 meses, um deles vazio.
    it('a janela sempre tem exatamente "meses" grupos, com ou sem conteúdo', () => {
      const grupos = agruparProximasContas([], hoje, 3);

      expect(grupos.map((g) => g.chave)).toEqual(['2026-09', '2026-10', '2026-11']);
      expect(grupos.every((g) => g.itens.length === 0)).toBe(true);
    });

    it('cenário do bug: mês corrente sem pendência (pago) continua na janela de 3 meses, vazio, entre os outros dois com conteúdo', () => {
      const gastos = [
        gasto({ data: '2026-10-05', valor: 100 }),
        gasto({ data: '2026-11-15', valor: 50, compraParceladaId: 3, gastoRecorrenteId: null })
      ];

      const grupos = agruparProximasContas(gastos, hoje, 3);

      expect(grupos.map((g) => g.chave)).toEqual(['2026-09', '2026-10', '2026-11']);
      expect(grupos[0]).toEqual(
        { chave: '2026-09', rotulo: 'Setembro de 2026', total: 0, itens: [], pendentesVencidos: 0 }
      );
      expect(grupos[1].itens.length).toBe(1);
      expect(grupos[1].total).toBe(100);
      expect(grupos[2].itens.length).toBe(1);
      expect(grupos[2].total).toBe(50);
    });

    it('a janela pré-semeada rola o ano corretamente (dezembro -> janeiro)', () => {
      const grupos = agruparProximasContas([], '2026-11-01', 3);

      expect(grupos.map((g) => g.chave)).toEqual(['2026-11', '2026-12', '2027-01']);
      expect(grupos[2].rotulo).toBe('Janeiro de 2027');
    });

    it('um mês atrasado anterior à janela ainda ganha grupo próprio (fallback preservado)', () => {
      const gastos = [gasto({ data: '2026-08-20', vencimentoOriginal: '2026-08-20' })];

      const grupos = agruparProximasContas(gastos, hoje, 1);

      expect(grupos.map((g) => g.chave)).toEqual(['2026-08', '2026-09']);
      expect(grupos[0].itens[0].status).toBe('ATRASADA');
      expect(grupos[1].itens).toEqual([]);
    });
  });

  describe('agendaTemAlgumItem', () => {
    const hoje = '2026-09-01';

    it('false quando todos os grupos da janela estão vazios (empty-state global deve aparecer)', () => {
      const grupos = agruparProximasContas([], hoje, 3);
      expect(agendaTemAlgumItem(grupos)).toBe(false);
    });

    it('true quando pelo menos um grupo tem item, mesmo com outros vazios misturados', () => {
      const gastos = [gasto({ data: '2026-10-05' })];
      const grupos = agruparProximasContas(gastos, hoje, 3);
      expect(agendaTemAlgumItem(grupos)).toBe(true);
    });
  });
});
