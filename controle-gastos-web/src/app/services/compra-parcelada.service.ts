import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';

import { API_BASE_URL } from '../core/api.constants';
import { CompraParcelada } from '../models/compra-parcelada.model';

@Injectable({
  providedIn: 'root'
})
export class CompraParceladaService {

  private readonly baseUrl = `${API_BASE_URL}/compras-parceladas`;

  constructor(private readonly http: HttpClient) { }

  listarTodos(): Observable<CompraParcelada[]> {
    return this.http.get<CompraParcelada[]>(this.baseUrl);
  }

  cadastrar(compra: CompraParcelada): Observable<CompraParcelada> {
    return this.http.post<CompraParcelada>(this.baseUrl, compra);
  }

  // Cancela a compra parcelada: a API marca como inativa e remove só as parcelas
  // futuras (ainda não vencidas), mantendo as passadas como histórico.
  excluir(id: number): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/${id}`);
  }
}
