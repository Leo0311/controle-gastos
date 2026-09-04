import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';

import { API_BASE_URL } from '../core/api.constants';
import { Categoria, Subcategoria } from '../models/categoria.model';

@Injectable({
  providedIn: 'root'
})
export class CategoriaService {

  private readonly baseUrl = `${API_BASE_URL}/categorias`;

  constructor(private readonly http: HttpClient) { }

  listarVisiveis(): Observable<Categoria[]> {
    return this.http.get<Categoria[]>(this.baseUrl);
  }

  criar(categoria: Categoria): Observable<Categoria> {
    return this.http.post<Categoria>(this.baseUrl, categoria);
  }

  atualizar(id: number, categoria: Categoria): Observable<Categoria> {
    return this.http.put<Categoria>(`${this.baseUrl}/${id}`, categoria);
  }

  excluir(id: number): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/${id}`);
  }

  // Envia a lista completa de IDs de categoria na ordem final desejada (drag &
  // drop na tela de Categorias). Retorna a lista inteira de categorias visíveis
  // já na nova ordem - a tela substitui o que tinha por essa resposta, sem
  // precisar recarregar tudo.
  reordenar(ids: number[]): Observable<Categoria[]> {
    return this.http.put<Categoria[]>(`${this.baseUrl}/ordem`, { ids });
  }

  listarTodasSubcategorias(): Observable<Subcategoria[]> {
    return this.http.get<Subcategoria[]>(`${API_BASE_URL}/subcategorias`);
  }

  listarSubcategorias(categoriaId: number): Observable<Subcategoria[]> {
    return this.http.get<Subcategoria[]>(`${this.baseUrl}/${categoriaId}/subcategorias`);
  }

  criarSubcategoria(categoriaId: number, subcategoria: Pick<Subcategoria, 'nome' | 'emoji'>): Observable<Subcategoria> {
    return this.http.post<Subcategoria>(`${this.baseUrl}/${categoriaId}/subcategorias`, subcategoria);
  }

  atualizarSubcategoria(id: number, subcategoria: Pick<Subcategoria, 'nome' | 'emoji'>): Observable<Subcategoria> {
    return this.http.put<Subcategoria>(`${API_BASE_URL}/subcategorias/${id}`, subcategoria);
  }

  excluirSubcategoria(id: number): Observable<void> {
    return this.http.delete<void>(`${API_BASE_URL}/subcategorias/${id}`);
  }
}
