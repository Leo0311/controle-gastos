import { Gasto } from '../models/gasto.model';
import { agregarStatus, ehGastoDeConta, statusDaConta } from './status-conta';

function gasto(parcial: Partial<Gasto>): Gasto {
  return {
    descricao: 'x',
    valor: 10,
    categoriaId: 1,
    data: '2026-09-10',
    ...parcial
  };
}

describe('status-conta', () => {
  const hoje = '2026-09-15';

  describe('statusDaConta', () => {
    it('PAGO quando a API marcou como pago, mesmo com vencimento no passado', () => {
      expect(statusDaConta(gasto({
        statusPagamento: 'PAGO', vencimentoOriginal: '2026-09-01'
      }), hoje)).toBe('PAGO');
    });

    it('avulso (statusPagamento ausente) é tratado como PAGO', () => {
      expect(statusDaConta(gasto({}), hoje)).toBe('PAGO');
    });

    it('ATRASADA quando pendente e o vencimento original já passou', () => {
      expect(statusDaConta(gasto({
        statusPagamento: 'PENDENTE', vencimentoOriginal: '2026-09-10'
      }), hoje)).toBe('ATRASADA');
    });

    it('PENDENTE quando pendente e o vencimento ainda não chegou', () => {
      expect(statusDaConta(gasto({
        statusPagamento: 'PENDENTE', vencimentoOriginal: '2026-09-20'
      }), hoje)).toBe('PENDENTE');
    });

    it('usa a própria data como vencimento quando vencimentoOriginal falta (legado)', () => {
      expect(statusDaConta(gasto({
        statusPagamento: 'PENDENTE', data: '2026-09-10', vencimentoOriginal: null
      }), hoje)).toBe('ATRASADA');
    });
  });

  describe('ehGastoDeConta', () => {
    it('true para gasto de recorrência ou parcela, false para avulso', () => {
      expect(ehGastoDeConta(gasto({ gastoRecorrenteId: 3 }))).toBe(true);
      expect(ehGastoDeConta(gasto({ compraParceladaId: 3 }))).toBe(true);
      expect(ehGastoDeConta(gasto({}))).toBe(false);
    });
  });

  describe('agregarStatus', () => {
    it('conta pendentes e atrasadas, ignorando pagos', () => {
      const resumo = agregarStatus([
        gasto({ statusPagamento: 'PENDENTE', vencimentoOriginal: '2026-09-20' }),
        gasto({ statusPagamento: 'PENDENTE', vencimentoOriginal: '2026-09-01' }),
        gasto({ statusPagamento: 'PENDENTE', vencimentoOriginal: '2026-09-02' }),
        gasto({ statusPagamento: 'PAGO', vencimentoOriginal: '2026-09-01' })
      ], hoje);

      expect(resumo).toEqual({ pendentes: 1, atrasadas: 2 });
    });
  });
});
