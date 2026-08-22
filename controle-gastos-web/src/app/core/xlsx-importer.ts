import * as XLSX from 'xlsx-js-style';

export interface LinhaImportacao {
  linha: number;
  descricao: string;
  categoria: string;
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

    resultado.push(validarLinha(linhaBruta, numeroLinha));
  }

  return resultado;
}

function validarLinha(linhaBruta: unknown[], numeroLinha: number): LinhaImportacao {
  const [descricaoBruta, valorBruto, categoriaBruta, dataBruta] = linhaBruta;

  const descricao = String(descricaoBruta ?? '').trim();
  const categoria = String(categoriaBruta ?? '').trim();
  const valor = converterValor(valorBruto);
  const data = converterData(dataBruta);

  let erro: string | null = null;
  if (!descricao) {
    erro = `Descrição vazia na linha ${numeroLinha}.`;
  } else if (valor === null || valor <= 0) {
    erro = `Valor inválido na linha ${numeroLinha}.`;
  } else if (!categoria) {
    erro = `Categoria vazia na linha ${numeroLinha}.`;
  } else if (!data) {
    erro = `Data inválida na linha ${numeroLinha}.`;
  }

  return {
    linha: numeroLinha,
    descricao,
    categoria,
    valorExibicao: exibirValor(valorBruto),
    valor,
    dataExibicao: exibirData(dataBruta),
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
