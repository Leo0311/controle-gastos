import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';

import { API_BASE_URL } from '../core/api.constants';
import { Orcamento, OrcamentoMes } from '../models/orcamento.model';

@Injectable({
  providedIn: 'root'
})
export class OrcamentoService {

  private readonly baseUrl = `${API_BASE_URL}/orcamentos`;

  constructor(private readonly http: HttpClient) { }

  listarTodos(): Observable<Orcamento[]> {
    return this.http.get<Orcamento[]>(this.baseUrl);
  }

  definir(orcamento: Orcamento): Observable<Orcamento> {
    return this.http.post<Orcamento>(this.baseUrl, orcamento);
  }

  atualizar(id: number, orcamento: Orcamento): Observable<Orcamento> {
    return this.http.put<Orcamento>(`${this.baseUrl}/${id}`, orcamento);
  }

  excluir(id: number): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/${id}`);
  }

  verMes(mes: number, ano: number): Observable<OrcamentoMes[]> {
    const params = new HttpParams().set('mes', mes).set('ano', ano);
    return this.http.get<OrcamentoMes[]>(`${this.baseUrl}/mes`, { params });
  }
}
