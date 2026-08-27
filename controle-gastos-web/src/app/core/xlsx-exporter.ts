import * as XLSX from 'xlsx-js-style';

import { Gasto } from '../models/gasto.model';

const NOME_MODELO_ARQUIVO = 'modelo_importacao_gastos.xlsx';

const ESTILO_CABECALHO = {
  font: { bold: true, color: { rgb: 'FFFFFF' } },
  fill: { fgColor: { rgb: '3F51B5' } },
  alignment: { horizontal: 'center', vertical: 'center' }
};

const ESTILO_EXEMPLO = {
  font: { italic: true, color: { rgb: '757575' } }
};

// Além do estilo visual (itálico/cinza), força 2 casas decimais na célula de
// valor - sem isso, o Excel exibe o número bruto (ex: "45.9" em vez de
// "45,90"), que fica ambíguo/inconsistente com o resto do app.
const ESTILO_EXEMPLO_VALOR = {
  ...ESTILO_EXEMPLO,
  numFmt: '0.00'
};

export function baixarModeloImportacaoGastos(): void {
  const cabecalho = ['Descrição', 'Valor', 'Categoria', 'Data'];
  const linhaExemplo = ['Almoço no restaurante', 45.9, 'Alimentação', '15/03/2026'];

  const planilha = XLSX.utils.aoa_to_sheet([cabecalho, linhaExemplo]);

  ['A1', 'B1', 'C1', 'D1'].forEach((endereco) => {
    planilha[endereco].s = ESTILO_CABECALHO;
  });

  ['A2', 'C2', 'D2'].forEach((endereco) => {
    planilha[endereco].s = ESTILO_EXEMPLO;
  });
  planilha['B2'].s = ESTILO_EXEMPLO_VALOR;

  planilha['!cols'] = [
    { wch: 30 },
    { wch: 12 },
    { wch: 20 },
    { wch: 14 }
  ];

  const livro = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(livro, planilha, 'Modelo');

  XLSX.writeFile(livro, NOME_MODELO_ARQUIVO);
}

export function exportarGastosXlsx(gastos: Gasto[]): void {
  const cabecalho = ['ID', 'Descrição', 'Valor', 'Categoria', 'Data'];
  const linhas = gastos.map((gasto) => [
    gasto.id,
    gasto.descricao,
    gasto.valor,
    gasto.categoria,
    formatarDataExibicao(gasto.data)
  ]);

  const planilha = XLSX.utils.aoa_to_sheet([cabecalho, ...linhas]);

  for (let coluna = 0; coluna < cabecalho.length; coluna++) {
    const endereco = XLSX.utils.encode_cell({ r: 0, c: coluna });
    planilha[endereco].s = ESTILO_CABECALHO;
  }

  // Larguras ajustadas por conteúdo; Data recebe espaço extra (14) para não
  // ficar cortada, já que carrega "dd/mm/aaaa" como texto (10 caracteres).
  planilha['!cols'] = [
    { wch: 8 },
    { wch: 30 },
    { wch: 12 },
    { wch: 20 },
    { wch: 14 }
  ];

  const livro = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(livro, planilha, 'Gastos');

  XLSX.writeFile(livro, nomeArquivoGastosComTimestamp());
}

function formatarDataExibicao(dataIso: string): string {
  const [ano, mes, dia] = dataIso.split('-');
  return `${dia}/${mes}/${ano}`;
}

function nomeArquivoGastosComTimestamp(): string {
  const agora = new Date();
  const ano = agora.getFullYear();
  const mes = String(agora.getMonth() + 1).padStart(2, '0');
  const dia = String(agora.getDate()).padStart(2, '0');
  const hora = String(agora.getHours()).padStart(2, '0');
  const min = String(agora.getMinutes()).padStart(2, '0');
  const seg = String(agora.getSeconds()).padStart(2, '0');
  return `gastos_exportados_${ano}${mes}${dia}_${hora}${min}${seg}.xlsx`;
}
