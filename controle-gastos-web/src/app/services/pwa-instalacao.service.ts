import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

// Tipagem mínima do evento beforeinstallprompt - não faz parte do lib.dom.d.ts padrão
// do TypeScript (é uma API não-standard, só Chrome/Edge/Android).
interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  readonly userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

@Injectable({
  providedIn: 'root'
})
export class PwaInstalacaoService {

  private deferredPrompt: BeforeInstallPromptEvent | null = null;
  private readonly podeInstalarSubject = new BehaviorSubject<boolean>(false);
  readonly podeInstalar$ = this.podeInstalarSubject.asObservable();

  // Safari no iOS nunca dispara beforeinstallprompt - o botão aparece mesmo assim
  // (ver AppComponent.instalarApp), e o clique mostra instruções manuais em vez de
  // disparar um prompt nativo (que lá não existe).
  readonly ehIOS = this.detectarIOS();

  constructor() {
    if (this.jaInstalado()) {
      // Rodando como app instalado (display-mode: standalone, ou navigator.standalone
      // no iOS) - nunca mostra o botão, não há nada a instalar.
      return;
    }

    window.addEventListener('beforeinstallprompt', (evento: Event) => {
      // Impede o mini-infobar automático do Chrome - o app decide quando oferecer a
      // instalação (o botão), não o navegador.
      evento.preventDefault();
      this.deferredPrompt = evento as BeforeInstallPromptEvent;
      this.podeInstalarSubject.next(true);
    });

    window.addEventListener('appinstalled', () => {
      this.deferredPrompt = null;
      this.podeInstalarSubject.next(false);
    });

    if (this.ehIOS) {
      this.podeInstalarSubject.next(true);
    }
  }

  // Dispara o prompt nativo de instalação, se houver um capturado (Chrome/Edge/
  // Android). Devolve true nesse caso (o chamador não precisa fazer mais nada) ou
  // false quando não há prompt nativo disponível (o chamador decide se mostra
  // instruções manuais, ver `ehIOS`). O evento capturado só pode ser usado uma vez -
  // depois de chamado (aceito ou recusado), o botão some até um novo evento chegar.
  async solicitarInstalacao(): Promise<boolean> {
    if (!this.deferredPrompt) {
      return false;
    }
    const prompt = this.deferredPrompt;
    this.deferredPrompt = null;
    this.podeInstalarSubject.next(this.ehIOS);
    await prompt.prompt();
    await prompt.userChoice;
    return true;
  }

  private jaInstalado(): boolean {
    const navegadorComStandalone = window.navigator as Navigator & { standalone?: boolean };
    return window.matchMedia('(display-mode: standalone)').matches || navegadorComStandalone.standalone === true;
  }

  private detectarIOS(): boolean {
    const janelaComMSStream = window as Window & { MSStream?: unknown };
    return /iPad|iPhone|iPod/.test(navigator.userAgent) && !janelaComMSStream.MSStream;
  }
}
