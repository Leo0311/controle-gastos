import { Gasto } from '../models/gasto.model';

const BOM = '﻿';

export function exportarGastosCsv(gastos: Gasto[]): void {
  const linhas = ['ID;Descrição;Valor;Categoria;Data', ...gastos.map(construirLinha)];
  const conteudo = BOM + linhas.join('\n') + '\n';
  const blob = new Blob([conteudo], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);

  const link = document.createElement('a');
  link.href = url;
  link.download = nomeArquivoComTimestamp();
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

function construirLinha(gasto: Gasto): string {
  return [
    String(gasto.id ?? ''),
    escapar(gasto.descricao),
    formatarValor(gasto.valor),
    escapar(gasto.categoria),
    formatarData(gasto.data)
  ].join(';');
}

function escapar(texto: string): string {
  if (texto == null) {
    return '';
  }
  if (texto.includes(';') || texto.includes('"') || texto.includes('\n')) {
    return `"${texto.replace(/"/g, '""')}"`;
  }
  return texto;
}

function formatarValor(valor: number): string {
  return valor.toFixed(2).replace('.', ',');
}

function formatarData(iso: string): string {
  const [ano, mes, dia] = iso.split('-');
  return `${dia}/${mes}/${ano}`;
}

function nomeArquivoComTimestamp(): string {
  const agora = new Date();
  const ano = agora.getFullYear();
  const mes = String(agora.getMonth() + 1).padStart(2, '0');
  const dia = String(agora.getDate()).padStart(2, '0');
  const hora = String(agora.getHours()).padStart(2, '0');
  const min = String(agora.getMinutes()).padStart(2, '0');
  const seg = String(agora.getSeconds()).padStart(2, '0');
  return `gastos_exportados_${ano}${mes}${dia}_${hora}${min}${seg}.csv`;
}
