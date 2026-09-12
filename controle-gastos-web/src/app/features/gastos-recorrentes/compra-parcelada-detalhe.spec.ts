import { Gasto } from '../../models/gasto.model';
import { GrupoAnoDetalhado, GrupoRestante, agruparPorAno, deveAgruparPorAno } from './compra-parcelada-detalhe';

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
  const gasto = (data: string, valor = 100): Gasto => ({
    descricao: 'Notebook', valor, categoriaId: 1, data
  });

  // Helper pra pegar um bucket 'ano' já tipado, sem `as` espalhado pelos testes.
  const comoAno = (g: ReturnType<typeof agruparPorAno>[number]) => g as GrupoAnoDetalhado;
  const comoRestante = (g: ReturnType<typeof agruparPorAno>[number]) => g as GrupoRestante;

  it('lista vazia não quebra', () => {
    expect(agruparPorAno([], '2026-09-12')).toEqual([]);
  });

  it('ano atual + ano seguinte, sem resto (compra que termina dentro do ano seguinte)', () => {
    const parcelas = [
      gasto('2026-11-10', 100),
      gasto('2026-12-10', 100),
      gasto('2027-01-10', 100),
      gasto('2027-02-10', 100),
      gasto('2027-03-10', 100)
    ];

    const grupos = agruparPorAno(parcelas, '2026-09-12');

    expect(grupos).toHaveSize(2);
    expect(grupos.map((g) => g.tipo)).toEqual(['ano', 'ano']);
    const [atual, seguinte] = grupos.map(comoAno);
    expect(atual.ano).toBe(2026);
    expect(atual.quantidade).toBe(2);
    expect(atual.total).toBe(200);
    expect(atual.expandidoPadrao).toBeTrue();
    expect(seguinte.ano).toBe(2027);
    expect(seguinte.quantidade).toBe(3);
    expect(seguinte.total).toBe(300);
    expect(seguinte.expandidoPadrao).toBeFalse();
  });

  it('compra de 13 parcelas: ano atual + seguinte cobrem tudo, sem resto', () => {
    // hoje = set/2026: 4 parcelas em 2026 (set-dez) + 9 em 2027 (jan-set) = 13.
    const parcelas = [
      gasto('2026-09-10'), gasto('2026-10-10'), gasto('2026-11-10'), gasto('2026-12-10'),
      gasto('2027-01-10'), gasto('2027-02-10'), gasto('2027-03-10'), gasto('2027-04-10'),
      gasto('2027-05-10'), gasto('2027-06-10'), gasto('2027-07-10'), gasto('2027-08-10'),
      gasto('2027-09-10')
    ];

    const grupos = agruparPorAno(parcelas, '2026-09-12');

    expect(grupos).toHaveSize(2);
    expect(grupos.reduce((soma, g) => soma + (g.tipo === 'ano' ? g.quantidade : 0), 0)).toBe(13);
    expect(grupos.some((g) => g.tipo === 'restante')).toBeFalse();
  });

  it('ano seguinte com resto: consolida tudo a partir de hoje+2 numa linha só', () => {
    const parcelas = [
      gasto('2026-06-10'),
      gasto('2027-06-10'),
      gasto('2028-06-10')
    ];

    const grupos = agruparPorAno(parcelas, '2026-06-01');

    expect(grupos).toHaveSize(3);
    expect(grupos.map((g) => g.tipo)).toEqual(['ano', 'ano', 'restante']);
    const restante = comoRestante(grupos[2]);
    expect(restante.quantidade).toBe(1);
    expect(restante.anos).toBe(0);
    expect(restante.meses).toBe(1);
  });

  it('quando o bucket do ano atual não existe, o ano seguinte assume expandidoPadrao', () => {
    // 1ª parcela só cai no ano seguinte - nada no ano atual (hoje=2026).
    const parcelas = [gasto('2027-01-10'), gasto('2027-02-10')];

    const grupos = agruparPorAno(parcelas, '2026-11-20');

    expect(grupos).toHaveSize(1);
    const seguinte = comoAno(grupos[0]);
    expect(seguinte.ano).toBe(2027);
    expect(seguinte.expandidoPadrao).toBeTrue();
  });

  it('duração do resto: caso redondo (24 meses = 2 anos e 0 meses)', () => {
    const parcelas = [
      gasto('2026-06-10'), // ano atual
      gasto('2027-06-10'), // ano seguinte
      ...Array.from({ length: 24 }, (_, i) => {
        const ano = 2028 + Math.floor(i / 12);
        const mes = String((i % 12) + 1).padStart(2, '0');
        return gasto(`${ano}-${mes}-10`);
      })
    ];

    const grupos = agruparPorAno(parcelas, '2026-06-01');

    const restante = comoRestante(grupos[2]);
    expect(restante.quantidade).toBe(24);
    expect(restante.anos).toBe(2);
    expect(restante.meses).toBe(0);
  });

  it('um único ano (parcelamento curto que não deveria nem chegar aqui) expande ele mesmo, sem seguinte nem resto', () => {
    const parcelas = [gasto('2026-09-10'), gasto('2026-10-10')];

    const grupos = agruparPorAno(parcelas, '2026-09-12');

    expect(grupos).toHaveSize(1);
    const unico = comoAno(grupos[0]);
    expect(unico.ano).toBe(2026);
    expect(unico.expandidoPadrao).toBeTrue();
  });
});
