import { Gasto } from '../models/gasto.model';
import { ehGastoDeConta, statusDaConta } from './status-conta';

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

    // Fronteira da regra: no PRÓPRIO dia do vencimento a conta ainda é Pendente;
    // só vira Atrasada a partir do dia seguinte (bug do fuso, 2026-09-08).
    it('PENDENTE quando o vencimento é exatamente hoje', () => {
      expect(statusDaConta(gasto({
        statusPagamento: 'PENDENTE', vencimentoOriginal: hoje
      }), hoje)).toBe('PENDENTE');
    });

    it('ATRASADA só a partir do dia seguinte ao vencimento', () => {
      expect(statusDaConta(gasto({
        statusPagamento: 'PENDENTE', vencimentoOriginal: '2026-09-14'
      }), hoje)).toBe('ATRASADA');
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
});
