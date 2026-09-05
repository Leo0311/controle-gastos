// Nomes de mês em pt-BR, um só lugar - antes havia ~7 cópias espalhadas pelas
// telas, em três variações (completo, abreviado, minúsculo) que já divergiam
// (achado M5 da auditoria 2026-09-05).

export const MESES_NOMES = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
];

export const MESES_ABREV = [
  'Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'
];

// [{ valor: 1, nome: 'Janeiro' }, ...] - formato consumido pelos <mat-select> de
// mês (Dashboard, Gastos, Análises). Imutável e computado uma vez.
export const MESES_OPCOES: ReadonlyArray<{ valor: number; nome: string }> =
  MESES_NOMES.map((nome, i) => ({ valor: i + 1, nome }));
