import { Categoria, Subcategoria } from '../../../models/categoria.model';
import { sugerirPorDicionario } from './dicionario-categorias';

// Categorias/subcategorias do sistema (usuarioId null) usadas nos testes - só as
// que o dicionário referencia nos casos abaixo.
const CATEGORIAS: Categoria[] = [
  { id: 1, nome: 'Alimentação', emoji: '🍽️', usuarioId: null },
  { id: 2, nome: 'Transporte', emoji: '🚗', usuarioId: null },
  { id: 3, nome: 'Saúde', emoji: '🏥', usuarioId: null },
  { id: 4, nome: 'Moradia', emoji: '🏠', usuarioId: null }
];

const SUBCATEGORIAS: Subcategoria[] = [
  { id: 10, categoriaId: 1, nome: 'Cafés e lanches', emoji: '☕', usuarioId: null },
  { id: 11, categoriaId: 1, nome: 'Restaurantes', emoji: '🍽️', usuarioId: null },
  { id: 12, categoriaId: 3, nome: 'Medicamentos', emoji: '💊', usuarioId: null },
  { id: 13, categoriaId: 4, nome: 'Aluguel', emoji: '🏡', usuarioId: null }
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
});
