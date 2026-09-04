import { ApplicationRef, Injectable, inject } from '@angular/core';
import { SwUpdate, VersionReadyEvent } from '@angular/service-worker';
import { Subject, filter, first } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class AtualizacaoService {

  private readonly swUpdate = inject(SwUpdate);
  private readonly appRef = inject(ApplicationRef);

  private readonly novaVersaoSubject = new Subject<void>();
  /** Emite quando uma versão nova do app já foi baixada e está pronta pra ativar. */
  readonly novaVersaoDisponivel$ = this.novaVersaoSubject.asObservable();

  constructor() {
    // Só habilitado em produção (build com --configuration production) - em
    // ng serve não há service worker registrado, e assinar os observables do
    // SwUpdate sem isEnabled lança erro.
    if (!this.swUpdate.isEnabled) {
      return;
    }

    this.swUpdate.versionUpdates
      .pipe(filter((evento): evento is VersionReadyEvent => evento.type === 'VERSION_READY'))
      .subscribe(() => this.novaVersaoSubject.next());

    // Cache do service worker ficou inconsistente e o app não consegue se
    // recuperar sozinho (ex: um chunk referenciado no manifest não existe mais
    // no servidor) - só resta recarregar. Sem aviso prévio: o app já está
    // quebrado nesse ponto, não há "continuar usando" possível.
    this.swUpdate.unrecoverable.subscribe(() => {
      document.location.reload();
    });

    // O Angular só verifica atualização sozinho a cada 30s depois do app
    // estabilizar (registrationStrategy 'registerWhenStable:30000', ver
    // app.config.ts) e depois disso só quando o navegador decide revalidar o SW.
    // Quem deixa o PWA aberto por dias sem recarregar pode nunca disparar uma
    // nova checagem - então força uma assim que o app estabiliza pela primeira vez.
    this.appRef.isStable
      .pipe(filter((estavel) => estavel), first())
      .subscribe(() => this.swUpdate.checkForUpdate());
  }

  /** Ativa a versão nova já baixada e recarrega a página. */
  async ativarNovaVersao(): Promise<void> {
    await this.swUpdate.activateUpdate();
    document.location.reload();
  }
}
