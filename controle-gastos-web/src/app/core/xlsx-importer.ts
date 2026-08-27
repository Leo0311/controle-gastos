import * as XLSX from 'xlsx-js-style';

export interface LinhaImportacao {
  linha: number;
  /** Preenchido quando a planilha é a exportação de gastos (tem coluna ID) e a célula é um ID válido. */
  id: number | null;
  descricao: string;
  categoria: string;
  subcategoria: string | null;
  valorExibicao: string;
  valor: number | null;
  dataExibicao: string;
  data: string | null;
  valido: boolean;
  erro: string | null;
}

export async function lerPlanilhaGastos(arquivo: File): Promise<LinhaImportacao[]> {
  const buffer = await arquivo.arrayBuffer();
  const livro = XLSX.read(buffer, { type: 'array', cellDates: true });
  const planilha = livro.Sheets[livro.SheetNames[0]];
  const linhasBrutas = XLSX.utils.sheet_to_json<unknown[]>(planilha, {
    header: 1,
    blankrows: false,
    defval: ''
  });

  if (linhasBrutas.length === 0) {
    return [];
  }

  // A planilha exportada (Exportar XLSX) tem uma coluna ID a mais no início,
  // que não existe no modelo de importação - sem essa checagem, reimportar o
  // arquivo exportado desalinha todas as colunas em uma posição.
  const comColunaId = ehFormatoExportado(linhasBrutas[0]);

  // Compatibilidade com planilhas geradas antes da coluna Subcategoria existir
  // (modelo/exportação antigos, sem essa coluna): detecta pela contagem de
  // colunas do cabeçalho, em vez de assumir sempre o layout novo - sem isso,
  // reimportar um arquivo antigo leria a Data de onde a Subcategoria estaria.
  const colunasBase = comColunaId ? 1 : 0;
  const comSubcategoria = linhasBrutas[0].length >= colunasBase + 5;

  const resultado: LinhaImportacao[] = [];

  for (let i = 1; i < linhasBrutas.length; i++) {
    const linhaBruta = linhasBrutas[i];
    const numeroLinha = i + 1;

    const totalmenteVazia = linhaBruta.every(
      (valor) => valor === '' || valor === null || valor === undefined
    );
    if (totalmenteVazia) {
      continue;
    }

    resultado.push(validarLinha(linhaBruta, numeroLinha, comColunaId, comSubcategoria));
  }

  return resultado;
}

function ehFormatoExportado(cabecalho: unknown[]): boolean {
  return String(cabecalho[0] ?? '').trim().toLowerCase() === 'id';
}

function converterId(bruto: unknown): number | null {
  if (typeof bruto === 'number' && Number.isInteger(bruto)) {
    return bruto;
  }
  if (typeof bruto === 'string' && bruto.trim() !== '') {
    const numero = Number(bruto.trim());
    return Number.isInteger(numero) ? numero : null;
  }
  return null;
}

function validarLinha(
  linhaBruta: unknown[], numeroLinha: number, comColunaId: boolean, comSubcategoria: boolean
): LinhaImportacao {
  const id = comColunaId ? converterId(linhaBruta[0]) : null;
  const semId = comColunaId ? linhaBruta.slice(1) : linhaBruta;

  // Layout antigo (sem a coluna Subcategoria): completa a posição dela com
  // undefined para que o restante da leitura (descrição/valor/categoria/data)
  // não desalinhe - uma planilha antiga sem essa coluna continua válida.
  const [descricaoBruta, valorBruto, categoriaBruta, subcategoriaBruta, dataBruta] = comSubcategoria
    ? semId
    : [semId[0], semId[1], semId[2], undefined, semId[3]];

  const descricao = String(descricaoBruta ?? '').trim();
  const categoria = String(categoriaBruta ?? '').trim();
  const subcategoria = String(subcategoriaBruta ?? '').trim() || null;
  const valor = converterValor(valorBruto);

  // Data não informada (célula vazia): assume a data de hoje em vez de rejeitar a linha.
  const dataInformada = !(dataBruta === '' || dataBruta === null || dataBruta === undefined);
  const data = dataInformada ? converterData(dataBruta) : dataDeHojeIso();
  const dataExibicao = dataInformada ? exibirData(dataBruta) : exibirData(new Date());

  let erro: string | null = null;
  if (!descricao) {
    erro = `Descrição vazia na linha ${numeroLinha}.`;
  } else if (valor === null || valor <= 0) {
    erro = `Valor inválido na linha ${numeroLinha}.`;
  } else if (!categoria) {
    erro = `Categoria vazia na linha ${numeroLinha}.`;
  } else if (dataInformada && !data) {
    erro = `Data inválida na linha ${numeroLinha}.`;
  }

  return {
    linha: numeroLinha,
    id,
    descricao,
    categoria,
    subcategoria,
    valorExibicao: exibirValor(valorBruto),
    valor,
    dataExibicao,
    data,
    valido: erro === null,
    erro
  };
}

function converterValor(bruto: unknown): number | null {
  if (typeof bruto === 'number') {
    return Number.isFinite(bruto) ? bruto : null;
  }
  if (typeof bruto === 'string') {
    const texto = bruto.trim().replace(',', '.');
    if (!texto) {
      return null;
    }
    const numero = Number(texto);
    return Number.isFinite(numero) ? numero : null;
  }
  return null;
}

function converterData(bruto: unknown): string | null {
  if (bruto instanceof Date) {
    if (Number.isNaN(bruto.getTime())) {
      return null;
    }
    return validarEFormatarData(bruto.getFullYear(), bruto.getMonth() + 1, bruto.getDate());
  }
  if (typeof bruto === 'number') {
    const componentes = extrairComponentesDataNumerica(bruto);
    return componentes ? validarEFormatarData(componentes[2], componentes[1], componentes[0]) : null;
  }
  if (typeof bruto === 'string') {
    const componentes = extrairComponentesDataTexto(bruto.trim());
    return componentes ? validarEFormatarData(componentes[2], componentes[1], componentes[0]) : null;
  }
  return null;
}

/**
 * Aceita dd/mm/aaaa, dd-mm-aaaa, dd.mm.aaaa (mesmo separador nos dois lados)
 * e ddmmaaaa sem separador (2+2+4 dígitos fixos).
 */
function extrairComponentesDataTexto(texto: string): [dia: number, mes: number, ano: number] | null {
  const comSeparador = /^(\d{1,2})([/\-.])(\d{1,2})\2(\d{4})$/.exec(texto);
  if (comSeparador) {
    return [Number(comSeparador[1]), Number(comSeparador[3]), Number(comSeparador[4])];
  }

  const semSeparador = /^(\d{2})(\d{2})(\d{4})$/.exec(texto);
  if (semSeparador) {
    return [Number(semSeparador[1]), Number(semSeparador[2]), Number(semSeparador[3])];
  }

  return null;
}

/**
 * Quando a célula de data não está formatada como texto, o Excel/LibreOffice
 * guarda "22082026" como o número 22082026 (e pode até derrubar zeros à
 * esquerda do dia/mês, ex: "01082026" vira 1082026). Reconstrói os 8 dígitos
 * com padStart antes de separar em dia/mês/ano.
 */
function extrairComponentesDataNumerica(bruto: number): [dia: number, mes: number, ano: number] | null {
  if (!Number.isFinite(bruto) || bruto < 0 || !Number.isInteger(bruto)) {
    return null;
  }
  const texto = String(bruto);
  if (texto.length > 8) {
    return null;
  }
  const textoCompleto = texto.padStart(8, '0');
  return [
    Number(textoCompleto.slice(0, 2)),
    Number(textoCompleto.slice(2, 4)),
    Number(textoCompleto.slice(4, 8))
  ];
}

function validarEFormatarData(ano: number, mes: number, dia: number): string | null {
  const data = new Date(ano, mes - 1, dia);
  if (data.getFullYear() !== ano || data.getMonth() !== mes - 1 || data.getDate() !== dia) {
    return null;
  }
  return formatarDataIso(ano, mes, dia);
}

function formatarDataIso(ano: number, mes: number, dia: number): string {
  return `${ano}-${String(mes).padStart(2, '0')}-${String(dia).padStart(2, '0')}`;
}

function dataDeHojeIso(): string {
  const hoje = new Date();
  return formatarDataIso(hoje.getFullYear(), hoje.getMonth() + 1, hoje.getDate());
}

function exibirValor(bruto: unknown): string {
  if (typeof bruto === 'number') {
    return bruto.toFixed(2).replace('.', ',');
  }
  if (typeof bruto === 'string') {
    return bruto.trim();
  }
  return '';
}

function exibirData(bruto: unknown): string {
  if (bruto instanceof Date && !Number.isNaN(bruto.getTime())) {
    const dia = String(bruto.getDate()).padStart(2, '0');
    const mes = String(bruto.getMonth() + 1).padStart(2, '0');
    return `${dia}/${mes}/${bruto.getFullYear()}`;
  }
  if (typeof bruto === 'number') {
    return String(bruto);
  }
  if (typeof bruto === 'string') {
    return bruto.trim();
  }
  return '';
}
