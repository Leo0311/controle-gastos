// Paleta curada só para dar um ponto de partida rápido no clique - o campo de
// texto ao lado aceita qualquer emoji digitado ou colado, sem ficar preso a ela.
// Não tem relação com o emoji das categorias/subcategorias padrão do sistema
// (esses ficam fixos, definidos na migração do banco em schema.sql) - só afeta
// a lista de sugestões ao criar/editar uma categoria ou subcategoria personalizada.
// Compartilhada entre CategoriaFormDialogComponent e SubcategoriaFormDialogComponent
// para as duas telas sempre oferecerem exatamente as mesmas opções.
export const PALETA_EMOJI = [
  '🍽️', '🍔', '🍕', '☕', '🛒', '🚗', '🚌', '🚕', '🚲', '⛽',
  '🏠', '🏥', '💊', '📚', '🎓', '🎮', '🎬', '🎵', '⚽', '✈️',
  '🏖️', '👕', '👟', '💡', '📱', '💻', '🐶', '🐱', '🎁', '💰',
  '💳', '📦',
  '💸', '💵', '🏦', '📈', '🧾', '💼', '💑', '🏋️', '🍺', '🧴', '🛠️', '🎂', '🎫'
];
