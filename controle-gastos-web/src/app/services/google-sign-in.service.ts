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
        oauth2: {
          initTokenClient(config: {
            client_id: string;
            scope: string;
            callback: (resposta: GoogleTokenResponse) => void;
            error_callback?: (erro: GoogleTokenErrorResponse) => void;
          }): GoogleTokenClient;
        };
      };
    };
  }
}

interface GoogleTokenResponse {
  access_token?: string;
  error?: string;
}

interface GoogleTokenErrorResponse {
  type: 'popup_failed_to_open' | 'popup_closed' | 'unknown';
}

interface GoogleTokenClient {
  requestAccessToken(): void;
}

/**
 * Encapsula a lib "Google Identity Services" (popup OAuth via
 * accounts.oauth2.initTokenClient - NÃO o One Tap/FedCM de accounts.id, que é
 * bloqueado por padrão em navegadores como a Brave e não suportado pelo
 * Firefox). Os componentes de login/cadastro só conhecem
 * credencial$/erro$/precarregar()/solicitarLogin(), nunca `window.google`
 * diretamente (mesmo espírito de AuthService escondendo o HttpClient).
 *
 * precarregar() carrega o script e cria o token client ANTES do clique -
 * chamado no ngOnInit do botão (ver GoogleSignInButtonComponent), não no
 * clique. Isso é essencial: requestAccessToken() só é reconhecido pelo
 * navegador como resultado direto de um gesto do usuário (e portanto livre
 * do bloqueador de popup) se for chamado de forma SÍNCRONA dentro do handler
 * de clique - se solicitarLogin() precisasse esperar uma Promise (carregar
 * script, inicializar) antes de chamar requestAccessToken(), esse intervalo
 * assíncrono quebraria a cadeia do gesto do usuário e o popup seria barrado.
 */
@Injectable({
  providedIn: 'root'
})
export class GoogleSignInService {

  private scriptCarregado: Promise<void> | null = null;
  private tokenClient: GoogleTokenClient | null = null;

  private readonly credencialSubject = new Subject<string>();
  private readonly erroSubject = new Subject<string>();

  // Access token do Google (string opaca, não é JWT) - o backend
  // (GoogleTokenVerifier) que confere validade/audiência via tokeninfo antes
  // de confiar em qualquer dado, e busca email/nome via userinfo.
  readonly credencial$ = this.credencialSubject.asObservable();
  readonly erro$ = this.erroSubject.asObservable();

  precarregar(): void {
    this.carregarScript()
      .then(() => this.garantirTokenClient())
      .catch(() => {
        // Silencioso de propósito: isto roda no ngOnInit do botão, antes de
        // qualquer intenção do usuário de logar. Se o script não carregou,
        // solicitarLogin() (no clique) detecta tokenClient nulo e avisa então.
      });
  }

  solicitarLogin(): void {
    if (!this.tokenClient) {
      this.erroSubject.next(
        'O login do Google ainda não carregou. Aguarde um instante e tente de novo.');
      return;
    }
    // Chamada síncrona - ver o porquê no javadoc da classe.
    this.tokenClient.requestAccessToken();
  }

  private carregarScript(): Promise<void> {
    if (this.scriptCarregado) {
      return this.scriptCarregado;
    }

    this.scriptCarregado = new Promise<void>((resolve, reject) => {
      if (window.google?.accounts?.oauth2) {
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

  private garantirTokenClient(): void {
    if (this.tokenClient) {
      return;
    }
    this.tokenClient = window.google!.accounts.oauth2.initTokenClient({
      client_id: environment.googleClientId,
      scope: 'openid email profile',
      callback: (resposta) => {
        if (resposta.error || !resposta.access_token) {
          this.erroSubject.next('Não foi possível entrar com o Google. Tente de novo.');
          return;
        }
        this.credencialSubject.next(resposta.access_token);
      },
      error_callback: (erro) => {
        // popup_closed: o usuário fechou o popup sem concluir - não é bem um
        // "erro" pra alarmar, mas ainda precisa destravar a tela de loading.
        const mensagem = erro.type === 'popup_closed'
          ? 'Login com o Google cancelado.'
          : 'Não foi possível abrir o login do Google. Verifique se o navegador não está bloqueando pop-ups.';
        this.erroSubject.next(mensagem);
      }
    });
  }
}
