export interface NotaFiscal {
  estabelecimento: string;
  valor: number;
  /** formato ISO yyyy-MM-dd, igual ao retornado pela API pra Gasto.data */
  dataEmissao: string;
}
