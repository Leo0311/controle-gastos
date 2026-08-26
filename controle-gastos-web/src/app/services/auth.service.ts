import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable, tap } from 'rxjs';

import { API_BASE_URL } from '../core/api.constants';
import { CadastroRequest, LoginRequest, LoginResponse, UsuarioLogado } from '../models/auth.model';

const STORAGE_KEY = 'controle_gastos_auth';

interface SessaoArmazenada {
  token: string;
  nome: string;
  email: string;
}

@Injectable({
  providedIn: 'root'
})
export class AuthService {

  private readonly baseUrl = `${API_BASE_URL}/auth`;

  // Token e usuário persistidos no localStorage, para sobreviver a F5 e a
  // fechar/reabrir a aba - só é limpo ao expirar (verificado via claim "exp"
  // do JWT) ou ao clicar em "Sair".
  private readonly tokenSubject = new BehaviorSubject<string | null>(null);
  private readonly usuarioSubject = new BehaviorSubject<UsuarioLogado | null>(null);

  readonly usuario$ = this.usuarioSubject.asObservable();

  constructor(private readonly http: HttpClient) {
    this.restaurarSessao();
  }

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
    localStorage.removeItem(STORAGE_KEY);
    this.tokenSubject.next(null);
    this.usuarioSubject.next(null);
  }

  private definirSessao(resposta: LoginResponse): void {
    const sessao: SessaoArmazenada = { token: resposta.token, nome: resposta.nome, email: resposta.email };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(sessao));
    this.tokenSubject.next(resposta.token);
    this.usuarioSubject.next({ nome: resposta.nome, email: resposta.email });
  }

  private restaurarSessao(): void {
    const bruto = localStorage.getItem(STORAGE_KEY);
    if (!bruto) {
      return;
    }

    try {
      const sessao: SessaoArmazenada = JSON.parse(bruto);
      if (this.tokenExpirado(sessao.token)) {
        localStorage.removeItem(STORAGE_KEY);
        return;
      }
      this.tokenSubject.next(sessao.token);
      this.usuarioSubject.next({ nome: sessao.nome, email: sessao.email });
    } catch {
      localStorage.removeItem(STORAGE_KEY);
    }
  }

  private tokenExpirado(token: string): boolean {
    const payload = this.decodificarPayload(token);
    if (!payload || typeof payload.exp !== 'number') {
      return true;
    }
    return payload.exp * 1000 <= Date.now();
  }

  private decodificarPayload(token: string): { exp?: number } | null {
    const partes = token.split('.');
    if (partes.length !== 3) {
      return null;
    }
    try {
      const base64 = partes[1].replace(/-/g, '+').replace(/_/g, '/');
      return JSON.parse(atob(base64));
    } catch {
      return null;
    }
  }
}
