import { Categoria } from '../models/categoria.model';

/**
 * Emoji de uma categoria pelo id, ou '' quando não há id (gasto legado sem
 * categoria gerida) ou o mapa ainda não carregou. Antes cada tela tinha sua
 * cópia deste método (achado M5 da auditoria 2026-09-05); as telas mantêm um
 * `categoriaEmoji(id)` fino que delega aqui, só pro template poder chamar.
 */
export function emojiDaCategoria(
  categoriasPorId: Map<number, Categoria>,
  categoriaId: number | null | undefined
): string {
  return categoriaId ? (categoriasPorId.get(categoriaId)?.emoji ?? '') : '';
}
