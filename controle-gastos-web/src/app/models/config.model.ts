// Espelha o ConfigDTO do backend (GET /api/config). Limites de validação que o
// formulário precisa conhecer para não deixar o usuário enviar algo que o
// servidor vai rejeitar (achado M3) - o backend continua sendo a autoridade.

export interface CompraParceladaLimites {
  parcelasMin: number;
  parcelasMax: number;
  primeiraParcelaMesesAtrasMax: number;
  primeiraParcelaMesesFrenteMax: number;
}

export interface Config {
  compraParcelada: CompraParceladaLimites;
}
