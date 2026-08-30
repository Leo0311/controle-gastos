import { Categoria, Subcategoria } from '../../../models/categoria.model';
import { sugerirPorDicionario } from './dicionario-categorias';

// Categorias/subcategorias do sistema (usuarioId null) usadas nos testes - só as
// que o dicionário referencia nos casos abaixo.
const CATEGORIAS: Categoria[] = [
  { id: 1, nome: 'Alimentação', emoji: '🍽️', usuarioId: null },
  { id: 2, nome: 'Transporte', emoji: '🚗', usuarioId: null },
  { id: 3, nome: 'Saúde', emoji: '🏥', usuarioId: null },
  { id: 4, nome: 'Moradia', emoji: '🏠', usuarioId: null },
  { id: 5, nome: 'Contas e serviços', emoji: '💡', usuarioId: null },
  { id: 6, nome: 'Lazer', emoji: '🎮', usuarioId: null }
];

const SUBCATEGORIAS: Subcategoria[] = [
  { id: 10, categoriaId: 1, nome: 'Cafés e lanches', emoji: '☕', usuarioId: null },
  { id: 11, categoriaId: 1, nome: 'Restaurantes', emoji: '🍽️', usuarioId: null },
  { id: 12, categoriaId: 3, nome: 'Medicamentos', emoji: '💊', usuarioId: null },
  { id: 13, categoriaId: 4, nome: 'Aluguel', emoji: '🏡', usuarioId: null },
  { id: 14, categoriaId: 3, nome: 'Dentista', emoji: '🦷', usuarioId: null },
  { id: 15, categoriaId: 2, nome: 'Seguro', emoji: '🛡️', usuarioId: null },
  { id: 16, categoriaId: 5, nome: 'Streaming', emoji: '🎬', usuarioId: null },
  { id: 17, categoriaId: 6, nome: 'Bares', emoji: '🍻', usuarioId: null }
  // De propósito SEM "Outros" em Transporte (id 2) - "pedágio" cai só na categoria.
];

describe('sugerirPorDicionario', () => {
  it('sugere pelo termo composto "café da manhã"', () => {
    expect(sugerirPorDicionario('café da manhã', CATEGORIAS, SUBCATEGORIAS))
      .toEqual({ categoriaId: 1, subcategoriaId: 10 });
  });

  it('sugere quando o termo aparece como palavra dentro da descrição ("jantar com esposa")', () => {
    expect(sugerirPorDicionario('jantar com esposa', CATEGORIAS, SUBCATEGORIAS))
      .toEqual({ categoriaId: 1, subcategoriaId: 11 });
  });

  it('sugere "farmácia" -> Saúde > Medicamentos', () => {
    expect(sugerirPorDicionario('farmácia', CATEGORIAS, SUBCATEGORIAS))
      .toEqual({ categoriaId: 3, subcategoriaId: 12 });
  });

  it('sugere "aluguel" -> Moradia > Aluguel', () => {
    expect(sugerirPorDicionario('aluguel do apê', CATEGORIAS, SUBCATEGORIAS))
      .toEqual({ categoriaId: 4, subcategoriaId: 13 });
  });

  it('devolve null quando nenhum termo casa', () => {
    expect(sugerirPorDicionario('reembolso de despesa diversa', CATEGORIAS, SUBCATEGORIAS)).toBeNull();
  });

  it('não casa termo de uma palavra como substring ("agua" não casa em "aguardando reembolso")', () => {
    expect(sugerirPorDicionario('aguardando reembolso', CATEGORIAS, SUBCATEGORIAS)).toBeNull();
  });

  it('devolve null quando a categoria do sistema não foi carregada', () => {
    expect(sugerirPorDicionario('farmácia', [], [])).toBeNull();
  });

  it('ignora categoria de mesmo nome que seja pessoal (usuarioId preenchido)', () => {
    const soPessoal: Categoria[] = [{ id: 99, nome: 'Saúde', emoji: '🏥', usuarioId: 7 }];
    expect(sugerirPorDicionario('farmácia', soPessoal, SUBCATEGORIAS)).toBeNull();
  });

  it('vence o termo mais específico quando dois casam (003 "cafe" e "cafe da manha")', () => {
    // Ambos apontam para a mesma subcategoria; o resultado é o mesmo, mas
    // garante que ter "cafe" na lista não atrapalha o composto.
    expect(sugerirPorDicionario('cafe da manha no shopping', CATEGORIAS, SUBCATEGORIAS))
      .toEqual({ categoriaId: 1, subcategoriaId: 10 });
  });

  describe('vocabulário expandido', () => {
    const casos: Array<[string, number, number | null]> = [
      ['pizza sexta a noite', 1, 11],       // Alimentação > Restaurantes
      ['hamburguer artesanal', 1, 11],      // Alimentação > Restaurantes
      ['cerveja com os amigos', 6, 17],     // Lazer > Bares
      ['dentista da minha filha', 3, 14],   // Saúde > Dentista
      ['assinatura netflix', 5, 16],        // Contas e serviços > Streaming
      ['streaming do mes', 5, 16],
      ['seguro do carro anual', 2, 15],     // Transporte > Seguro (termo composto)
      ['fui na padaria comprar pao', 1, null] // "pao"/"padaria" -> Alimentação > Padaria (subcat não está no fixture -> null)
    ];
    for (const [texto, catId, subId] of casos) {
      it(`"${texto}" -> categoria ${catId}, subcategoria ${subId}`, () => {
        expect(sugerirPorDicionario(texto, CATEGORIAS, SUBCATEGORIAS))
          .toEqual({ categoriaId: catId, subcategoriaId: subId });
      });
    }
  });

  it('degrada pra só a categoria quando a subcategoria do dicionário não existe ("pedágio" -> Transporte)', () => {
    // A entrada de "pedágio" aponta pra Transporte > "Outros", que não é
    // subcategoria de sistema - então volta só a categoria, sem quebrar.
    expect(sugerirPorDicionario('pedágio da rodovia', CATEGORIAS, SUBCATEGORIAS))
      .toEqual({ categoriaId: 2, subcategoriaId: null });
  });

  it('trata hífen como espaço ("lava-jato" casa a entrada "lava jato")', () => {
    // Sem subcategoria "Lavagem" no fixture -> categoria Transporte, subcat null.
    expect(sugerirPorDicionario('lava-jato do fim de semana', CATEGORIAS, SUBCATEGORIAS))
      .toEqual({ categoriaId: 2, subcategoriaId: null });
  });
});
