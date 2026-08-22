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
    return formatarDataIso(bruto.getFullYear(), bruto.getMonth() + 1, bruto.getDate());
  }
  if (typeof bruto === 'string') {
    const texto = bruto.trim();
    const match = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(texto);
    if (!match) {
      return null;
    }
    const dia = Number(match[1]);
    const mes = Number(match[2]);
    const ano = Number(match[3]);
    const data = new Date(ano, mes - 1, dia);
    if (data.getFullYear() !== ano || data.getMonth() !== mes - 1 || data.getDate() !== dia) {
      return null;
    }
    return formatarDataIso(ano, mes, dia);
  }
  return null;
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
  if (typeof bruto === 'string') {
    return bruto.trim();
  }
  return '';
}
