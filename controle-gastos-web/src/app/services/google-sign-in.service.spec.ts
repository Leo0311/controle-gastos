import { TestBed } from '@angular/core/testing';

import { GoogleSignInService } from './google-sign-in.service';

const SRC_SCRIPT_GOOGLE = 'https://accounts.google.com/gsi/client';

describe('GoogleSignInService', () => {
  let service: GoogleSignInService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(GoogleSignInService);
  });

  afterEach(() => {
    delete window.google;
    document.querySelectorAll(`script[src="${SRC_SCRIPT_GOOGLE}"]`).forEach((el) => el.remove());
  });

  it('deve ser criado', () => {
    expect(service).toBeTruthy();
  });

  it('solicitarLogin() sem precarregar() antes emite erro$ (token client ainda não existe)', (done) => {
    service.erro$.subscribe((mensagem) => {
      expect(mensagem).toContain('ainda não carregou');
      done();
    });

    service.solicitarLogin();
  });

  it('precarregar() cria o token client com client_id e escopo certos quando o script já está disponível', (done) => {
    const initTokenClientSpy = jasmine.createSpy('initTokenClient').and.returnValue({
      requestAccessToken: jasmine.createSpy('requestAccessToken')
    });
    window.google = { accounts: { oauth2: { initTokenClient: initTokenClientSpy } } };

    service.precarregar();

    // A cadeia de promises interna resolve numa microtask - um tick basta.
    setTimeout(() => {
      expect(initTokenClientSpy).toHaveBeenCalledTimes(1);
      const config = initTokenClientSpy.calls.mostRecent().args[0];
      expect(config.client_id).toBeTruthy();
      expect(config.scope).toBe('openid email profile');
      expect(document.querySelector(`script[src="${SRC_SCRIPT_GOOGLE}"]`)).toBeNull();
      done();
    });
  });

  it('solicitarLogin() chama requestAccessToken() de forma síncrona depois que precarregar() resolveu', (done) => {
    const requestAccessTokenSpy = jasmine.createSpy('requestAccessToken');
    window.google = {
      accounts: { oauth2: { initTokenClient: () => ({ requestAccessToken: requestAccessTokenSpy }) } }
    };

    service.precarregar();

    setTimeout(() => {
      service.solicitarLogin();
      expect(requestAccessTokenSpy).toHaveBeenCalledTimes(1);
      done();
    });
  });

  it('emite credencial$ com o access_token quando o Google devolve sucesso', (done) => {
    let callbackCapturado!: (resposta: { access_token?: string; error?: string }) => void;
    window.google = {
      accounts: {
        oauth2: {
          initTokenClient: (config) => {
            callbackCapturado = config.callback;
            return { requestAccessToken: () => callbackCapturado({ access_token: 'access-token-fake' }) };
          }
        }
      }
    };

    service.credencial$.subscribe((accessToken) => {
      expect(accessToken).toBe('access-token-fake');
      done();
    });

    service.precarregar();
    setTimeout(() => service.solicitarLogin());
  });

  it('emite erro$ quando o callback devolve resposta sem access_token (campo error preenchido)', (done) => {
    let callbackCapturado!: (resposta: { access_token?: string; error?: string }) => void;
    window.google = {
      accounts: {
        oauth2: {
          initTokenClient: (config) => {
            callbackCapturado = config.callback;
            return { requestAccessToken: () => callbackCapturado({ error: 'access_denied' }) };
          }
        }
      }
    };

    service.erro$.subscribe((mensagem) => {
      expect(mensagem).toContain('Google');
      done();
    });

    service.precarregar();
    setTimeout(() => service.solicitarLogin());
  });

  it('emite mensagem específica quando o usuário fecha o popup (error_callback popup_closed)', (done) => {
    let errorCallbackCapturado!: (erro: { type: 'popup_failed_to_open' | 'popup_closed' | 'unknown' }) => void;
    window.google = {
      accounts: {
        oauth2: {
          initTokenClient: (config) => {
            errorCallbackCapturado = config.error_callback!;
            return { requestAccessToken: () => errorCallbackCapturado({ type: 'popup_closed' }) };
          }
        }
      }
    };

    service.erro$.subscribe((mensagem) => {
      expect(mensagem).toBe('Login com o Google cancelado.');
      done();
    });

    service.precarregar();
    setTimeout(() => service.solicitarLogin());
  });

  it('emite mensagem de pop-up bloqueado quando error_callback devolve popup_failed_to_open', (done) => {
    let errorCallbackCapturado!: (erro: { type: 'popup_failed_to_open' | 'popup_closed' | 'unknown' }) => void;
    window.google = {
      accounts: {
        oauth2: {
          initTokenClient: (config) => {
            errorCallbackCapturado = config.error_callback!;
            return { requestAccessToken: () => errorCallbackCapturado({ type: 'popup_failed_to_open' }) };
          }
        }
      }
    };

    service.erro$.subscribe((mensagem) => {
      expect(mensagem).toContain('bloqueando pop-ups');
      done();
    });

    service.precarregar();
    setTimeout(() => service.solicitarLogin());
  });

  it('insere o script do Google no <head> quando ele ainda não existe nem foi carregado', (done) => {
    expect(document.querySelector(`script[src="${SRC_SCRIPT_GOOGLE}"]`)).toBeNull();

    service.precarregar();

    setTimeout(() => {
      expect(document.querySelector(`script[src="${SRC_SCRIPT_GOOGLE}"]`)).not.toBeNull();
      done();
    });
  });

  it('quando o script falha ao carregar, precarregar() fica em silêncio mas solicitarLogin() avisa depois', (done) => {
    service.precarregar();

    setTimeout(() => {
      // Simula a falha de carregamento sem depender de rede de verdade no
      // Karma: dispara o evento "error" no <script> recém-inserido.
      document.querySelector(`script[src="${SRC_SCRIPT_GOOGLE}"]`)?.dispatchEvent(new Event('error'));

      setTimeout(() => {
        service.erro$.subscribe((mensagem) => {
          expect(mensagem).toContain('ainda não carregou');
          done();
        });
        service.solicitarLogin();
      });
    });
  });
});
