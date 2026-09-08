import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable, catchError, shareReplay, tap, throwError } from 'rxjs';

import { API_BASE_URL } from '../core/api.constants';
import { Orcamento, OrcamentoMes } from '../models/orcamento.model';

@Injectable({
  providedIn: 'root'
})
export class OrcamentoService {

  private readonly baseUrl = `${API_BASE_URL}/orcamentos`;

  // Cache de sessão para a lista completa de orçamentos - pedida por gastos.component,
  // pelos diálogos de gasto/recorrente e pelo orquestrador de importação, cada um por
  // conta própria. Mesma ideia do CategoriaService: shareReplay(1) quente até uma
  // mutação zerar. NÃO cacheia verMes(mes,ano): esse depende do período e reflete a
  // soma dos gastos do mês, que muda o tempo todo.
  private todos$?: Observable<Orcamento[]>;

  constructor(private readonly http: HttpClient) { }

  listarTodos(): Observable<Orcamento[]> {
    if (!this.todos$) {
      this.todos$ = this.http.get<Orcamento[]>(this.baseUrl).pipe(
        catchError((erro) => {
          this.todos$ = undefined;
          return throwError(() => erro);
        }),
        shareReplay({ bufferSize: 1, refCount: false })
      );
    }
    return this.todos$;
  }

  definir(orcamento: Orcamento): Observable<Orcamento> {
    return this.http.post<Orcamento>(this.baseUrl, orcamento).pipe(tap(() => this.invalidarCache()));
  }

  atualizar(id: number, orcamento: Orcamento): Observable<Orcamento> {
    return this.http.put<Orcamento>(`${this.baseUrl}/${id}`, orcamento).pipe(tap(() => this.invalidarCache()));
  }

  excluir(id: number): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/${id}`).pipe(tap(() => this.invalidarCache()));
  }

  verMes(mes: number, ano: number): Observable<OrcamentoMes[]> {
    const params = new HttpParams().set('mes', mes).set('ano', ano);
    return this.http.get<OrcamentoMes[]>(`${this.baseUrl}/mes`, { params });
  }

  private invalidarCache(): void {
    this.todos$ = undefined;
  }
}
