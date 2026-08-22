import * as XLSX from 'xlsx-js-style';

const NOME_ARQUIVO = 'modelo_importacao_gastos.xlsx';

const ESTILO_CABECALHO = {
  font: { bold: true, color: { rgb: 'FFFFFF' } },
  fill: { fgColor: { rgb: '3F51B5' } },
  alignment: { horizontal: 'center', vertical: 'center' }
};

const ESTILO_EXEMPLO = {
  font: { italic: true, color: { rgb: '757575' } }
};

export function baixarModeloImportacaoGastos(): void {
  const cabecalho = ['Descrição', 'Valor', 'Categoria', 'Data'];
  const linhaExemplo = ['Almoço no restaurante', 45.9, 'Alimentação', '15/03/2026'];

  const planilha = XLSX.utils.aoa_to_sheet([cabecalho, linhaExemplo]);

  ['A1', 'B1', 'C1', 'D1'].forEach((endereco) => {
    planilha[endereco].s = ESTILO_CABECALHO;
  });

  ['A2', 'B2', 'C2', 'D2'].forEach((endereco) => {
    planilha[endereco].s = ESTILO_EXEMPLO;
  });

  planilha['!cols'] = [
    { wch: 30 },
    { wch: 12 },
    { wch: 20 },
    { wch: 14 }
  ];

  const livro = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(livro, planilha, 'Modelo');

  XLSX.writeFile(livro, NOME_ARQUIVO);
}
