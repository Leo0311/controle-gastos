import { Gasto } from '../../../models/gasto.model';
import { LinhaImportacao } from '../../../core/xlsx-importer';
import { AtualizacaoImportacao } from '../importar-atualizacao-dialog/importar-atualizacao-dialog.component';

/**
 * Lógica de decisão da importação de gastos, isolada do componente e dos
 * diálogos pra ser testável sozinha (achado C2 da auditoria 2026-09-05). Cada
 * linha da planilha cai em exatamente um balde; o orquestrador é quem decide o
 * que fazer com cada balde (perguntar, criar, atualizar, ignorar).
 */
export interface ClassificacaoImportacao {
  /** Linha com ID que casa com um gasto atual e tem algum campo diferente. */
  atualizacoes: AtualizacaoImportacao[];
  /** Linha sem ID que não parece nenhum gasto existente - vira gasto novo. */
  linhasNovas: LinhaImportacao[];
  /** Linha com ID que não corresponde a nenhum gasto atual (excluído, export antigo). */
  linhasSuspeitas: LinhaImportacao[];
  /** Linha sem ID, mas descrição+categoria batem com um gasto e valor/data diferem. */
  linhasPossivelEdicao: LinhaImportacao[];
  /** Quantas linhas eram idênticas a um gasto já cadastrado (ignoradas em silêncio). */
  jaCadastradas: number;
}

// Descrição, valor (tolerância de 1 milésimo), categoria, subcategoria e data:
// se qualquer um difere, a linha "mexe" em relação ao gasto existente.
export function gastoMudou(existente: Gasto, linha: LinhaImportacao): boolean {
  return existente.descricao !== linha.descricao
    || Math.abs(existente.valor - (linha.valor ?? 0)) > 0.001
    || (existente.categoria ?? '').toLowerCase() !== linha.categoria.toLowerCase()
    || (existente.subcategoria ?? '').toLowerCase() !== (linha.subcategoria ?? '').toLowerCase()
    || existente.data !== linha.data;
}

export function classificarLinhas(
  linhas: LinhaImportacao[],
  gastosAtuais: Gasto[]
): ClassificacaoImportacao {
  const porId = new Map(gastosAtuais.map((g) => [g.id, g]));

  const resultado: ClassificacaoImportacao = {
    atualizacoes: [],
    linhasNovas: [],
    linhasSuspeitas: [],
    linhasPossivelEdicao: [],
    jaCadastradas: 0
  };

  for (const linha of linhas) {
    // Bate exatamente com um gasto já cadastrado (mesma planilha reimportada) -
    // nunca cria de novo, com ou sem coluna ID; só conta pra avisar no final.
    if (gastosAtuais.some((g) => !gastoMudou(g, linha))) {
      resultado.jaCadastradas++;
      continue;
    }

    if (linha.id != null) {
      const existente = porId.get(linha.id);
      if (!existente) {
        // Tinha ID mas não corresponde a nada atual: pode ser export antigo ou
        // gasto já excluído. Não cria sem perguntar.
        resultado.linhasSuspeitas.push(linha);
      } else {
        // A checagem de duplicata acima já garantiu que algo mudou.
        resultado.atualizacoes.push({ linha, existente, atualizar: true });
      }
      continue;
    }

    // Sem ID: descrição e categoria batem com um gasto existente, mas valor ou
    // data diferem - provavelmente uma tentativa de EDITAR sem ter como saber
    // qual gasto é. Sem essa checagem, a linha seria criada como um gasto novo,
    // duplicando o original.
    const possivelEdicao = gastosAtuais.some((g) =>
      g.descricao.trim().toLowerCase() === linha.descricao.trim().toLowerCase()
      && (g.categoria ?? '').trim().toLowerCase() === linha.categoria.trim().toLowerCase()
      && gastoMudou(g, linha)
    );
    if (possivelEdicao) {
      resultado.linhasPossivelEdicao.push(linha);
    } else {
      resultado.linhasNovas.push(linha);
    }
  }

  return resultado;
}
