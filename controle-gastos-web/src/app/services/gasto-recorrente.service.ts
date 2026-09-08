import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable, catchError, of } from 'rxjs';

import { API_BASE_URL } from '../core/api.constants';
import { GastoRecorrente } from '../models/gasto-recorrente.model';
import { Gasto } from '../models/gasto.model';

@Injectable({
  providedIn: 'root'
})
export class GastoRecorrenteService {

  private readonly baseUrl = `${API_BASE_URL}/gastos-recorrentes`;

  // Antes o Dashboard e a tela de Gastos chamavam lancarPendentes() em TODO mount -
  // um POST que varre as recorrências no servidor, a cada navegação. Agora passa por
  // lancarPendentesSeNecessario(), que roda no máximo 1x a cada 5 min por sessão
  // (o service é singleton providedIn:'root').
  private readonly intervaloLancamentoMs = 5 * 60 * 1000;
  private ultimoLancamento = 0;

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
  // gastos criados nesta chamada (lista vazia se nada estava pendente).
  lancarPendentes(): Observable<Gasto[]> {
    return this.http.post<Gasto[]>(`${this.baseUrl}/lancar-pendentes`, {});
  }

  // Versão throttled de lancarPendentes(), para o Dashboard e a tela de Gastos
  // chamarem ao montar sem martelar o endpoint a cada navegação: dispara no máximo
  // 1x a cada 5 min por sessão. Fora dessa janela devolve of([]) sem tocar a rede.
  // Erro é engolido (devolve of([])) - a verificação é transparente pro usuário - e
  // reabre a janela na hora, pra a próxima tela tentar de novo.
  lancarPendentesSeNecessario(): Observable<Gasto[]> {
    const agora = Date.now();
    if (agora - this.ultimoLancamento < this.intervaloLancamentoMs) {
      return of<Gasto[]>([]);
    }
    this.ultimoLancamento = agora;
    return this.lancarPendentes().pipe(
      catchError(() => {
        this.ultimoLancamento = 0;
        return of<Gasto[]>([]);
      })
    );
  }

  // Ação em lote: marca como pagas todas as ocorrências vencidas (<= hoje) e ainda
  // pendentes desta recorrência, com valor/data previstos. Devolve as quitadas.
  pagarVencidas(id: number): Observable<Gasto[]> {
    return this.http.post<Gasto[]>(`${this.baseUrl}/${id}/pagar-vencidas`, {});
  }
}
