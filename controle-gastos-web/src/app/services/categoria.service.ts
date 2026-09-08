import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable, catchError, shareReplay, tap, throwError } from 'rxjs';

import { API_BASE_URL } from '../core/api.constants';
import { Categoria, Subcategoria } from '../models/categoria.model';

@Injectable({
  providedIn: 'root'
})
export class CategoriaService {

  private readonly baseUrl = `${API_BASE_URL}/categorias`;

  // Cache de sessão para as duas listas de referência que praticamente toda tela e
  // todo diálogo pedem ao montar (categorias visíveis, todas as subcategorias). Sem
  // isso, navegar Dashboard -> Gastos -> Análises disparava GET /categorias 3x+ (e
  // 10x+ com diálogos), cada um custando ~3 round-trips VM<->Neon. shareReplay com
  // refCount:false mantém o último resultado quente mesmo sem assinantes; qualquer
  // mutação abaixo zera o cache, então a próxima leitura refaz. Uma falha não é
  // cacheada (catchError zera o campo) - a próxima tentativa/"Tentar novamente"
  // refaz de verdade.
  private categoriasVisiveis$?: Observable<Categoria[]>;
  private todasSubcategorias$?: Observable<Subcategoria[]>;

  constructor(private readonly http: HttpClient) { }

  listarVisiveis(): Observable<Categoria[]> {
    if (!this.categoriasVisiveis$) {
      this.categoriasVisiveis$ = this.http.get<Categoria[]>(this.baseUrl).pipe(
        catchError((erro) => {
          this.categoriasVisiveis$ = undefined;
          return throwError(() => erro);
        }),
        shareReplay({ bufferSize: 1, refCount: false })
      );
    }
    return this.categoriasVisiveis$;
  }

  // Categorias visíveis com pelo menos um gasto no mês/ano informado - alimenta o
  // dropdown "Filtrar por categoria" da tela de Gastos. Sem mes/ano (ou nulos) =
  // qualquer período, usado no modo "Ver todos os meses". NÃO é cacheado: o
  // resultado depende do período e muda quando um gasto é criado/removido.
  listarComGastos(mes?: number | null, ano?: number | null): Observable<Categoria[]> {
    let params = new HttpParams();
    if (mes) {
      params = params.set('mes', mes);
    }
    if (ano) {
      params = params.set('ano', ano);
    }
    return this.http.get<Categoria[]>(`${this.baseUrl}/com-gastos`, { params });
  }

  criar(categoria: Categoria): Observable<Categoria> {
    return this.http.post<Categoria>(this.baseUrl, categoria).pipe(tap(() => this.invalidarCache()));
  }

  atualizar(id: number, categoria: Categoria): Observable<Categoria> {
    return this.http.put<Categoria>(`${this.baseUrl}/${id}`, categoria).pipe(tap(() => this.invalidarCache()));
  }

  excluir(id: number): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/${id}`).pipe(tap(() => this.invalidarCache()));
  }

  // Envia a lista completa de IDs de categoria na ordem final desejada (drag &
  // drop na tela de Categorias). Retorna a lista inteira de categorias visíveis
  // já na nova ordem - a tela substitui o que tinha por essa resposta, sem
  // precisar recarregar tudo.
  reordenar(ids: number[]): Observable<Categoria[]> {
    return this.http.put<Categoria[]>(`${this.baseUrl}/ordem`, { ids }).pipe(tap(() => this.invalidarCache()));
  }

  listarTodasSubcategorias(): Observable<Subcategoria[]> {
    if (!this.todasSubcategorias$) {
      this.todasSubcategorias$ = this.http.get<Subcategoria[]>(`${API_BASE_URL}/subcategorias`).pipe(
        catchError((erro) => {
          this.todasSubcategorias$ = undefined;
          return throwError(() => erro);
        }),
        shareReplay({ bufferSize: 1, refCount: false })
      );
    }
    return this.todasSubcategorias$;
  }

  listarSubcategorias(categoriaId: number): Observable<Subcategoria[]> {
    return this.http.get<Subcategoria[]>(`${this.baseUrl}/${categoriaId}/subcategorias`);
  }

  criarSubcategoria(categoriaId: number, subcategoria: Pick<Subcategoria, 'nome' | 'emoji'>): Observable<Subcategoria> {
    return this.http.post<Subcategoria>(`${this.baseUrl}/${categoriaId}/subcategorias`, subcategoria)
      .pipe(tap(() => this.invalidarCache()));
  }

  atualizarSubcategoria(id: number, subcategoria: Pick<Subcategoria, 'nome' | 'emoji'>): Observable<Subcategoria> {
    return this.http.put<Subcategoria>(`${API_BASE_URL}/subcategorias/${id}`, subcategoria)
      .pipe(tap(() => this.invalidarCache()));
  }

  excluirSubcategoria(id: number): Observable<void> {
    return this.http.delete<void>(`${API_BASE_URL}/subcategorias/${id}`).pipe(tap(() => this.invalidarCache()));
  }

  // Zera as duas listas de referência. Qualquer mutação (categoria ou subcategoria)
  // invalida as duas: excluir uma categoria cascateia nas subcategorias dela, e é
  // barato demais pra valer a pena rastrear qual afeta qual.
  private invalidarCache(): void {
    this.categoriasVisiveis$ = undefined;
    this.todasSubcategorias$ = undefined;
  }
}
