import { Injectable } from '@angular/core';
import { Subject } from 'rxjs';

import { environment } from '../../environments/environment';

const SRC_SCRIPT_GOOGLE = 'https://accounts.google.com/gsi/client';

// Só o pedacinho da API do Google Identity Services que este serviço usa -
// não existe @types oficial instalado só para isso.
declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize(config: {
            client_id: string;
            callback: (resposta: { credential: string }) => void;
          }): void;
          prompt(): void;
        };
      };
    };
  }
}

/**
 * Encapsula a lib "Google Identity Services" (Sign-In) - os componentes de
 * login/cadastro só conhecem credencial$/erro$/solicitarLogin(), nunca
 * `window.google` diretamente (mesmo espírito de AuthService escondendo o
 * HttpClient). O script do Google só é carregado quando alguém chama
 * solicitarLogin() pela 1ª vez - não em toda página do app, só nas telas de
 * login/cadastro que usam o botão.
 */
@Injectable({
  providedIn: 'root'
})
export class GoogleSignInService {

  private scriptCarregado: Promise<void> | null = null;
  private inicializado = false;

  private readonly credencialSubject = new Subject<string>();
  private readonly erroSubject = new Subject<string>();

  // ID token do Google, já assinado - o backend (GoogleTokenVerifier) que
  // confere assinatura/emissor/audiência antes de confiar em qualquer campo.
  readonly credencial$ = this.credencialSubject.asObservable();
  readonly erro$ = this.erroSubject.asObservable();

  solicitarLogin(): void {
    this.carregarScript()
      .then(() => {
        this.garantirInicializado();
        window.google!.accounts.id.prompt();
      })
      .catch(() => this.erroSubject.next(
        'Não foi possível carregar o login do Google. Verifique sua conexão e tente novamente.'));
  }

  private carregarScript(): Promise<void> {
    if (this.scriptCarregado) {
      return this.scriptCarregado;
    }

    this.scriptCarregado = new Promise<void>((resolve, reject) => {
      if (window.google?.accounts?.id) {
        resolve();
        return;
      }
      const script = document.createElement('script');
      script.src = SRC_SCRIPT_GOOGLE;
      script.async = true;
      script.defer = true;
      script.onload = () => resolve();
      script.onerror = () => reject(new Error('Falha ao carregar o script do Google Identity Services.'));
      document.head.appendChild(script);
    });

    return this.scriptCarregado;
  }

  private garantirInicializado(): void {
    if (this.inicializado) {
      return;
    }
    window.google!.accounts.id.initialize({
      client_id: environment.googleClientId,
      callback: (resposta) => this.credencialSubject.next(resposta.credential)
    });
    this.inicializado = true;
  }
}
