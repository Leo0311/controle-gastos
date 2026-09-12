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

  it('quando o script do Google já está disponível, inicializa e chama prompt() sem inserir script de novo', (done) => {
    const initializeSpy = jasmine.createSpy('initialize');
    const promptSpy = jasmine.createSpy('prompt');
    window.google = { accounts: { id: { initialize: initializeSpy, prompt: promptSpy } } };

    service.solicitarLogin();

    // A cadeia de promises interna resolve numa microtask - um tick basta.
    setTimeout(() => {
      expect(initializeSpy).toHaveBeenCalledTimes(1);
      expect(initializeSpy.calls.mostRecent().args[0].client_id).toBeTruthy();
      expect(promptSpy).toHaveBeenCalledTimes(1);
      expect(document.querySelector(`script[src="${SRC_SCRIPT_GOOGLE}"]`)).toBeNull();
      done();
    });
  });

  it('emite credencial$ com o ID token quando o callback do Google devolve um credential', (done) => {
    let callbackCapturado!: (resposta: { credential: string }) => void;
    window.google = {
      accounts: {
        id: {
          initialize: (config) => { callbackCapturado = config.callback; },
          prompt: () => callbackCapturado({ credential: 'id-token-fake' })
        }
      }
    };

    service.credencial$.subscribe((idToken) => {
      expect(idToken).toBe('id-token-fake');
      done();
    });

    service.solicitarLogin();
  });

  it('insere o script do Google no <head> quando ele ainda não existe nem foi carregado', (done) => {
    expect(document.querySelector(`script[src="${SRC_SCRIPT_GOOGLE}"]`)).toBeNull();

    service.solicitarLogin();

    setTimeout(() => {
      expect(document.querySelector(`script[src="${SRC_SCRIPT_GOOGLE}"]`)).not.toBeNull();
      done();
    });
  });

  it('emite erro$ com mensagem amigável quando o script falha ao carregar', (done) => {
    service.erro$.subscribe((mensagem) => {
      expect(mensagem).toContain('Google');
      done();
    });

    service.solicitarLogin();

    // Simula a falha de carregamento sem depender de rede de verdade no Karma:
    // dispara o evento "error" no <script> recém-inserido, que aciona o
    // onerror atribuído por GoogleSignInService.
    setTimeout(() => {
      document.querySelector(`script[src="${SRC_SCRIPT_GOOGLE}"]`)?.dispatchEvent(new Event('error'));
    });
  });
});
