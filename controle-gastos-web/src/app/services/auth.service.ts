import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable, tap } from 'rxjs';

import { API_BASE_URL } from '../core/api.constants';
import { CadastroRequest, LoginRequest, LoginResponse, UsuarioLogado } from '../models/auth.model';

@Injectable({
  providedIn: 'root'
})
export class AuthService {

  private readonly baseUrl = `${API_BASE_URL}/auth`;

  // Token guardado só em memória (não em localStorage): some ao recarregar a página.
  private readonly tokenSubject = new BehaviorSubject<string | null>(null);
  private readonly usuarioSubject = new BehaviorSubject<UsuarioLogado | null>(null);

  readonly usuario$ = this.usuarioSubject.asObservable();

  constructor(private readonly http: HttpClient) { }

  get token(): string | null {
    return this.tokenSubject.value;
  }

  get autenticado(): boolean {
    return this.tokenSubject.value !== null;
  }

  cadastrar(dados: CadastroRequest): Observable<LoginResponse> {
    return this.http.post<LoginResponse>(`${this.baseUrl}/cadastro`, dados)
      .pipe(tap((resposta) => this.definirSessao(resposta)));
  }

  login(dados: LoginRequest): Observable<LoginResponse> {
    return this.http.post<LoginResponse>(`${this.baseUrl}/login`, dados)
      .pipe(tap((resposta) => this.definirSessao(resposta)));
  }

  esqueciSenha(email: string): Observable<void> {
    return this.http.post<void>(`${this.baseUrl}/esqueci-senha`, { email });
  }

  redefinirSenha(token: string, novaSenha: string): Observable<void> {
    return this.http.post<void>(`${this.baseUrl}/redefinir-senha`, { token, novaSenha });
  }

  sair(): void {
    this.tokenSubject.next(null);
    this.usuarioSubject.next(null);
  }

  private definirSessao(resposta: LoginResponse): void {
    this.tokenSubject.next(resposta.token);
    this.usuarioSubject.next({ nome: resposta.nome, email: resposta.email });
  }
}
