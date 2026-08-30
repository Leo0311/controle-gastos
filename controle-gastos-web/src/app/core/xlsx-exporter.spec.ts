import { construirPlanilhaGastos } from './xlsx-exporter';
import { Gasto } from '../models/gasto.model';

function gasto(parcial: Partial<Gasto>): Gasto {
  return {
    id: 1,
    descricao: 'Padaria',
    valor: 10,
    categoria: 'Alimentação',
    subcategoria: null,
    data: '2026-03-15',
    categoriaId: 1,
    subcategoriaId: null,
    orcamentoId: null,
    ...parcial
  } as Gasto;
}

describe('construirPlanilhaGastos', () => {
  it('neutraliza descrição/categoria/subcategoria que começam com caractere de fórmula', () => {
    const planilha = construirPlanilhaGastos([
      gasto({
        id: 7,
        descricao: '=HYPERLINK("http://exemplo.com")',
        categoria: '@categoria',
        subcategoria: '-subcat'
      })
    ]);

    // Linha 1 = cabeçalho; linha 2 = primeiro gasto.
    expect(planilha['B2'].v).toBe('\'=HYPERLINK("http://exemplo.com")');
    expect(planilha['B2'].t).toBe('s');
    expect(planilha['B2'].f).toBeUndefined();
    expect(planilha['D2'].v).toBe("'@categoria");
    expect(planilha['E2'].v).toBe("'-subcat");
  });

  it('não altera valores comuns nem o número do valor', () => {
    const planilha = construirPlanilhaGastos([
      gasto({ id: 3, descricao: 'Almoço', valor: 45.9, categoria: 'Alimentação' })
    ]);

    expect(planilha['B2'].v).toBe('Almoço');
    expect(planilha['C2'].v).toBe(45.9);
    expect(planilha['C2'].t).toBe('n');
  });
});
