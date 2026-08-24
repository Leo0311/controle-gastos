import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';

import { API_BASE_URL } from '../core/api.constants';
import { Meta, MetaMes, MetaRequest, Renda } from '../models/meta.model';

@Injectable({
  providedIn: 'root'
})
export class MetaService {

  private readonly baseUrl = `${API_BASE_URL}/metas`;
  private readonly usuariosUrl = `${API_BASE_URL}/usuarios`;

  constructor(private readonly http: HttpClient) { }

  metaDoMes(mes: number, ano: number): Observable<MetaMes> {
    const params = new HttpParams().set('mes', mes).set('ano', ano);
    return this.http.get<MetaMes>(`${this.baseUrl}/mes`, { params });
  }

  definir(dados: MetaRequest): Observable<Meta> {
    return this.http.post<Meta>(this.baseUrl, dados);
  }

  excluir(id: number): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/${id}`);
  }

  atualizarRenda(rendaMensal: number): Observable<Renda> {
    return this.http.put<Renda>(`${this.usuariosUrl}/renda`, { rendaMensal });
  }
}
