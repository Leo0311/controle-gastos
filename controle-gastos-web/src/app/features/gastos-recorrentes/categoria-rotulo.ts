import { Categoria, Subcategoria } from '../../models/categoria.model';

/**
 * Rótulos de categoria/subcategoria usados nas abas "Recorrentes" e "Parceladas"
 * (achado M8). Diferente do `emojiDaCategoria` de core/ (só o emoji): aqui é
 * "emoji + nome", o formato que as duas listas mostram. Os componentes mantêm um
 * método fino que delega aqui, só pro template poder chamar.
 */

/** "🍽️ Alimentação" pela categoria; '' se o mapa ainda não carregou. */
export function rotuloCategoria(categoriasPorId: Map<number, Categoria>, categoriaId: number): string {
  const categoria = categoriasPorId.get(categoriaId);
  return categoria ? `${categoria.emoji} ${categoria.nome}` : '';
}

/** Nome da subcategoria; '' se não houver id ou o mapa não tiver. */
export function rotuloSubcategoria(
  subcategoriasPorId: Map<number, Subcategoria>,
  subcategoriaId: number | null | undefined
): string {
  return subcategoriaId ? (subcategoriasPorId.get(subcategoriaId)?.nome ?? '') : '';
}
