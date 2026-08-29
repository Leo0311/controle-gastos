export interface Categoria {
  id?: number;
  nome: string;
  emoji: string;
  /** null = categoria padrão do sistema, visível para todos. */
  usuarioId?: number | null;
}

export interface Subcategoria {
  id?: number;
  categoriaId: number;
  nome: string;
  emoji: string;
  /** null = subcategoria padrão do sistema, visível para todos. */
  usuarioId?: number | null;
}
