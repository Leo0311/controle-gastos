import { AfterViewInit, Directive, ElementRef, NgZone, OnDestroy, inject } from '@angular/core';

/**
 * Faz o cabeçalho de um `<mat-tab-group>` rolar arrastando o dedo, não só pelas
 * setinhas `<` `>` de paginação.
 *
 * Por que precisa: o Angular Material pagina o cabeçalho deslocando o
 * `.mat-mdc-tab-list` via `transform: translateX(...)` dentro de um container
 * (`.mat-mdc-tab-label-container`) que vem com `overflow: hidden` — ou seja, sem
 * rolagem nativa por toque. O CSS que acompanha esta diretiva
 * (`gastos-recorrentes.component.css`) troca esse `overflow` por `auto`
 * (habilitando o gesto de arrastar) e remove a transição do `.mat-mdc-tab-list`.
 *
 * O que a diretiva faz: converte cada deslocamento que o Material aplicaria via
 * `transform` (clique nas setinhas, navegação por teclado, "trazer a aba
 * selecionada pra vista") em `scrollLeft` nativo do container, e zera o
 * `transform`. Assim os dois mecanismos usam a mesma posição de rolagem e não
 * brigam (sem o `translateX` do Material somando por cima do `scrollLeft`).
 *
 * O gesto global de trocar de seção (`app.component`) já ignora swipes que
 * começam dentro de um elemento com scroll-x próprio, então não conflita.
 */
@Directive({
  selector: 'mat-tab-group[appAbasArrastaveis]',
  standalone: true
})
export class AbasArrastaveisDirective implements AfterViewInit, OnDestroy {

  // Valor que a diretiva deixa no `transform` depois de converter o
  // deslocamento em scrollLeft. `scaleX(1)` é identidade (não muda nada na tela);
  // serve só de sentinela: o Material sempre escreve `translateX(<inteiro>px)`
  // sozinho, nunca esta string - então toda escrita dele é detectada como
  // mudança de verdade, inclusive quando ele volta pra `translateX(0px)`.
  private static readonly NEUTRO = 'translateX(0px) scaleX(1)';

  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly zone = inject(NgZone);
  private observer?: MutationObserver;

  ngAfterViewInit(): void {
    const container = this.host.nativeElement.querySelector<HTMLElement>('.mat-mdc-tab-label-container');
    const lista = this.host.nativeElement.querySelector<HTMLElement>('.mat-mdc-tab-list');
    if (!container || !lista) {
      return;
    }

    this.zone.runOutsideAngular(() => {
      this.observer = new MutationObserver(() => {
        if (lista.style.transform === AbasArrastaveisDirective.NEUTRO) {
          return; // eco do nosso próprio reset
        }
        container.scrollLeft = this.deslocamentoPedido(lista);
        lista.style.transform = AbasArrastaveisDirective.NEUTRO;
      });
      this.observer.observe(lista, { attributes: true, attributeFilter: ['style'] });
    });
  }

  ngOnDestroy(): void {
    this.observer?.disconnect();
  }

  /** Distância em px que o Material pediu pra deslocar (translateX, sempre ≤ 0 em LTR). */
  private deslocamentoPedido(lista: HTMLElement): number {
    const encontrado = /translateX\(\s*(-?[\d.]+)px/.exec(lista.style.transform);
    return encontrado ? Math.round(Math.abs(parseFloat(encontrado[1]))) : 0;
  }
}
