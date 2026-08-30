// Neutralização de injeção de fórmula ("CSV injection") na geração de planilhas.
//
// Excel/LibreOffice interpretam como fórmula qualquer célula de texto que comece
// com =, +, -, @ ou um caractere de controle (tab / carriage return). Como a
// descrição e o nome de categoria/subcategoria de um gasto são texto livre do
// usuário, exportá-los sem tratamento permitiria que um valor como
// =HYPERLINK("http://...") fosse executado ao abrir o arquivo. Prefixar com um
// apóstrofo força o app de planilha a tratar o conteúdo como texto puro.

const PREFIXO_PERIGOSO = /^[=+\-@\t\r]/;

export function neutralizarFormula(valor: unknown): unknown {
  if (typeof valor !== 'string' || valor.length === 0) {
    return valor;
  }
  return PREFIXO_PERIGOSO.test(valor) ? `'${valor}` : valor;
}

/** Aplica neutralizarFormula a cada célula de uma matriz (array de arrays). */
export function sanitizarLinhas(linhas: unknown[][]): unknown[][] {
  return linhas.map((linha) => linha.map(neutralizarFormula));
}
