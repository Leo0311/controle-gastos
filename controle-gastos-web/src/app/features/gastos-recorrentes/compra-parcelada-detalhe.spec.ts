import { Gasto } from '../../models/gasto.model';
import { agruparPorAno, deveAgruparPorAno } from './compra-parcelada-detalhe';

describe('deveAgruparPorAno', () => {
  it('não agrupa com 12 parcelas ou menos', () => {
    expect(deveAgruparPorAno(2)).toBeFalse();
    expect(deveAgruparPorAno(12)).toBeFalse();
  });

  it('agrupa a partir de 13 parcelas', () => {
    expect(deveAgruparPorAno(13)).toBeTrue();
    expect(deveAgruparPorAno(104)).toBeTrue();
  });
});

describe('agruparPorAno', () => {
  const gasto = (data: string, valor: number): Gasto => ({
    descricao: 'Notebook', valor, categoriaId: 1, data
  });

  it('lista vazia não quebra', () => {
    expect(agruparPorAno([], '2026-09-12')).toEqual([]);
  });

  it('agrupa por ano civil, somando total e contando quantidade por grupo', () => {
    const parcelas = [
      gasto('2026-11-10', 100),
      gasto('2026-12-10', 100),
      gasto('2027-01-10', 100),
      gasto('2027-02-10', 100),
      gasto('2027-03-10', 100)
    ];

    const grupos = agruparPorAno(parcelas, '2026-09-12');

    expect(grupos.map((g) => g.ano)).toEqual([2026, 2027]);
    expect(grupos[0].quantidade).toBe(2);
    expect(grupos[0].total).toBe(200);
    expect(grupos[1].quantidade).toBe(3);
    expect(grupos[1].total).toBe(300);
  });

  it('grupos saem em ordem cronológica mesmo se as parcelas chegarem fora de ordem', () => {
    const parcelas = [gasto('2028-01-10', 10), gasto('2026-01-10', 10), gasto('2027-01-10', 10)];

    const grupos = agruparPorAno(parcelas, '2026-06-01');

    expect(grupos.map((g) => g.ano)).toEqual([2026, 2027, 2028]);
  });

  it('o ano corrente vem expandido por padrão quando está no meio do horizonte', () => {
    const parcelas = [gasto('2026-01-10', 10), gasto('2027-01-10', 10), gasto('2028-01-10', 10)];

    const grupos = agruparPorAno(parcelas, '2027-06-01');

    expect(grupos.find((g) => g.ano === 2027)!.expandidoPadrao).toBeTrue();
    expect(grupos.find((g) => g.ano === 2026)!.expandidoPadrao).toBeFalse();
    expect(grupos.find((g) => g.ano === 2028)!.expandidoPadrao).toBeFalse();
  });

  it('compra inteira no passado expande o ano mais recente (nunca deixa tudo colapsado)', () => {
    const parcelas = [gasto('2020-01-10', 10), gasto('2021-01-10', 10)];

    const grupos = agruparPorAno(parcelas, '2026-09-12');

    expect(grupos.find((g) => g.ano === 2021)!.expandidoPadrao).toBeTrue();
    expect(grupos.find((g) => g.ano === 2020)!.expandidoPadrao).toBeFalse();
  });

  it('compra inteira no futuro expande o ano mais próximo (o primeiro)', () => {
    const parcelas = [gasto('2030-01-10', 10), gasto('2031-01-10', 10)];

    const grupos = agruparPorAno(parcelas, '2026-09-12');

    expect(grupos.find((g) => g.ano === 2030)!.expandidoPadrao).toBeTrue();
    expect(grupos.find((g) => g.ano === 2031)!.expandidoPadrao).toBeFalse();
  });

  it('um único ano (parcelamento curto que não deveria nem chegar aqui) expande ele mesmo', () => {
    const parcelas = [gasto('2026-09-10', 10), gasto('2026-10-10', 10)];

    const grupos = agruparPorAno(parcelas, '2026-09-12');

    expect(grupos).toHaveSize(1);
    expect(grupos[0].expandidoPadrao).toBeTrue();
  });
});
