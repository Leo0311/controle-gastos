import { Gasto } from '../../../models/gasto.model';

/** Combinação categoria+subcategoria sugerida a partir do histórico. */
export interface SugestaoCategoria {
  categoriaId: number;
  subcategoriaId: number | null;
}

/**
 * Normaliza uma descrição para a comparação "parecida": sem espaços nas pontas,
 * minúscula e sem acento (NFD + remoção dos diacríticos U+0300–U+036F), para que
 * "açaí" case com "acai" e "Uber" com "uber".
 */
export function normalizarDescricao(texto: string): string {
  return texto
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '');
}

/**
 * Dada a descrição sendo digitada e o histórico de gastos do usuário, devolve a
 * combinação categoria+subcategoria mais frequente entre os gastos com descrição
 * "parecida" — correspondência por substring nos dois sentidos (o texto digitado
 * aparece dentro de uma descrição anterior, ou vice-versa), case/acento-insensitive.
 *
 * Só considera gastos que já têm `categoriaId`. Em caso de empate na contagem,
 * vence a combinação do gasto mais recente. Devolve `null` quando o texto tem
 * menos de 3 caracteres (após normalizar) ou quando não há nenhum gasto parecido.
 */
export function calcularSugestaoCategoria(texto: string, gastos: Gasto[]): SugestaoCategoria | null {
  const alvo = normalizarDescricao(texto);
  if (alvo.length < 3) {
    return null;
  }

  const parecidos = gastos
    .filter((g) => g.categoriaId != null)
    .filter((g) => {
      const descricao = normalizarDescricao(g.descricao ?? '');
      return descricao.length > 0 && (descricao.includes(alvo) || alvo.includes(descricao));
    })
    // Mais recente primeiro: assim, num empate de contagem, a primeira combinação
    // a atingir o máximo (e portanto a escolhida) é a do gasto mais recente.
    .sort((a, b) => (b.data ?? '').localeCompare(a.data ?? ''));

  if (parecidos.length === 0) {
    return null;
  }

  const contagem = new Map<string, { combo: SugestaoCategoria; total: number }>();
  let melhorChave = '';
  let melhorTotal = 0;

  for (const gasto of parecidos) {
    const combo: SugestaoCategoria = {
      categoriaId: gasto.categoriaId,
      subcategoriaId: gasto.subcategoriaId ?? null
    };
    const chave = `${combo.categoriaId}|${combo.subcategoriaId ?? ''}`;
    const atual = contagem.get(chave) ?? { combo, total: 0 };
    atual.total += 1;
    contagem.set(chave, atual);
    if (atual.total > melhorTotal) {
      melhorTotal = atual.total;
      melhorChave = chave;
    }
  }

  return contagem.get(melhorChave)!.combo;
}
