import { HttpClient } from '@angular/common/http';
import { Injectable, inject, signal } from '@angular/core';

import { API_BASE_URL } from '../core/api.constants';
import { CompraParceladaLimites, Config } from '../models/config.model';

// Valores atuais do backend - usados como fallback enquanto GET /api/config não
// retorna (ou se falhar). Coincidem de propósito com CompraParceladaService no
// backend; a graça do achado M3 é que, quando o backend mudar, o frontend passa
// a acompanhar sozinho na próxima carga - sem precisar mexer aqui.
const LIMITES_PADRAO: CompraParceladaLimites = {
  parcelasMin: 2,
  parcelasMax: 120,
  primeiraParcelaMesesAtrasMax: 12,
  primeiraParcelaMesesFrenteMax: 2
};

@Injectable({ providedIn: 'root' })
export class ConfigService {

  private readonly http = inject(HttpClient);
  private readonly config = signal<Config>({ compraParcelada: LIMITES_PADRAO });
  private buscou = false;

  /** Snapshot atual (padrão até o GET /api/config responder). */
  limitesCompraParcelada(): CompraParceladaLimites {
    return this.config().compraParcelada;
  }

  /** Signal reativo, pra quem quiser reagir à chegada do config. */
  readonly limitesCompraParceladaSignal = this.config;

  // Busca uma vez por carga do app. Chamado por quem for usar (hoje só o diálogo
  // de gasto). Falha silenciosa - mantém os padrões e tenta de novo na próxima.
  garantirCarregado(): void {
    if (this.buscou) {
      return;
    }
    this.buscou = true;
    this.http.get<Config>(`${API_BASE_URL}/config`).subscribe({
      next: (c) => this.config.set(c),
      error: () => { this.buscou = false; }
    });
  }
}
