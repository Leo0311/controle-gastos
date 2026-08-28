import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';

import { API_BASE_URL } from '../core/api.constants';
import { GastoRecorrente } from '../models/gasto-recorrente.model';
import { Gasto } from '../models/gasto.model';

@Injectable({
  providedIn: 'root'
})
export class GastoRecorrenteService {

  private readonly baseUrl = `${API_BASE_URL}/gastos-recorrentes`;

  constructor(private readonly http: HttpClient) { }

  listarTodos(): Observable<GastoRecorrente[]> {
    return this.http.get<GastoRecorrente[]>(this.baseUrl);
  }

  cadastrar(recorrente: GastoRecorrente): Observable<GastoRecorrente> {
    return this.http.post<GastoRecorrente>(this.baseUrl, recorrente);
  }

  atualizar(id: number, recorrente: GastoRecorrente): Observable<GastoRecorrente> {
    return this.http.put<GastoRecorrente>(`${this.baseUrl}/${id}`, recorrente);
  }

  excluir(id: number): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/${id}`);
  }

  alternarAtivo(id: number): Observable<GastoRecorrente> {
    return this.http.patch<GastoRecorrente>(`${this.baseUrl}/${id}/ativar-desativar`, {});
  }

  // Verifica e lança os gastos recorrentes pendentes do mês atual; devolve só os
  // gastos criados nesta chamada (lista vazia se nada estava pendente). Chamado de
  // forma transparente ao abrir o Dashboard e a tela de Gastos.
  lancarPendentes(): Observable<Gasto[]> {
    return this.http.post<Gasto[]>(`${this.baseUrl}/lancar-pendentes`, {});
  }
}
