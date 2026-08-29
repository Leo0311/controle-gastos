import { AsyncPipe } from '@angular/common';
import { AfterViewInit, Component, ElementRef, inject, OnDestroy, ViewChild } from '@angular/core';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatTabsModule } from '@angular/material/tabs';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';

import { AuthService } from './services/auth.service';
import { TemaService } from './services/tema.service';

const NOMES_MESES = [
  'janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho',
  'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'
];

// Mesma ordem das seções na bottom nav (ver app.component.html) - o swipe
// horizontal navega por essa lista. Só ativo em telas <=600px, mesma faixa em
// que a bottom nav aparece (ver LARGURA_MAXIMA_MOBILE abaixo).
const ORDEM_NAVEGACAO = ['/dashboard', '/gastos', '/orcamentos', '/categorias', '/gastos-recorrentes'];

const LARGURA_MAXIMA_MOBILE = 600;
// Margem a partir da borda da tela onde o gesto é ignorado, pra não competir
// com o gesto nativo de "voltar" do navegador/sistema (que começa bem na borda).
const MARGEM_BORDA_IGNORADA = 30;
// Distância mínima (em qualquer eixo) antes de decidir se o gesto é um swipe
// horizontal ou uma rolagem vertical normal - evita decidir errado com base
// só no primeiro pixel de movimento, que costuma ser ruidoso.
const LIMIAR_DECISAO_EIXO = 10;
// Só considera "horizontal" se o deslocamento nesse eixo for claramente maior
// que no vertical - assim a rolagem vertical da página nunca é interrompida
// por engano perto da diagonal.
const PROPORCAO_MINIMA_HORIZONTAL = 1.3;
// Distância mínima de arraste (px reais, sem o amortecimento visual) pra
// confirmar a navegação ao soltar o dedo; abaixo disso, volta pro centro sem trocar de tela.
const LIMIAR_NAVEGACAO = 70;
// O deslocamento visual acompanha o dedo com folga (não 1:1), pra dar noção
// de direção sem o conteúdo "voar" pra fora da tela durante o arraste.
const AMORTECIMENTO_VISUAL = 0.4;

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [
    AsyncPipe, RouterOutlet, RouterLink, RouterLinkActive,
    MatToolbarModule, MatTabsModule, MatIconModule, MatButtonModule
  ],
  templateUrl: './app.component.html',
  styleUrl: './app.component.css'
})
export class AppComponent implements AfterViewInit, OnDestroy {
  title = 'controle-gastos-web';

  private readonly authService = inject(AuthService);
  private readonly temaService = inject(TemaService);
  private readonly router = inject(Router);

  readonly usuario$ = this.authService.usuario$;
  readonly temaEscuro$ = this.temaService.escuro$;
  readonly mesAnoAtual: string;

  @ViewChild('conteudo') private conteudoRef?: ElementRef<HTMLElement>;

  /** Deslocamento horizontal atual do conteúdo, em px - usado no [style.transform] do template. */
  deslocamentoAtual = 0;
  /** Liga a transição CSS suave (usada ao soltar o dedo); desligada durante o arraste, pra acompanhar o dedo instantaneamente. */
  comTransicao = false;

  private touchStartX = 0;
  private touchStartY = 0;
  private eixoDecidido = false;
  private ehSwipeHorizontal = false;
  private gestoIgnorado = false;

  private readonly onTouchStart = (evento: TouchEvent): void => this.tratarTouchStart(evento);
  private readonly onTouchMove = (evento: TouchEvent): void => this.tratarTouchMove(evento);
  private readonly onTouchEnd = (): void => this.tratarTouchEnd();

  constructor() {
    const hoje = new Date();
    const texto = `${NOMES_MESES[hoje.getMonth()]} de ${hoje.getFullYear()}`;
    this.mesAnoAtual = texto.charAt(0).toUpperCase() + texto.slice(1);
  }

  ngAfterViewInit(): void {
    const elemento = this.conteudoRef?.nativeElement;
    if (!elemento) {
      return;
    }
    elemento.addEventListener('touchstart', this.onTouchStart, { passive: true });
    // touchmove precisa ser non-passive pra poder cancelar o comportamento
    // nativo (rolagem/rubber-band horizontal) quando um swipe é confirmado.
    elemento.addEventListener('touchmove', this.onTouchMove, { passive: false });
    elemento.addEventListener('touchend', this.onTouchEnd, { passive: true });
    elemento.addEventListener('touchcancel', this.onTouchEnd, { passive: true });
  }

  ngOnDestroy(): void {
    const elemento = this.conteudoRef?.nativeElement;
    if (!elemento) {
      return;
    }
    elemento.removeEventListener('touchstart', this.onTouchStart);
    elemento.removeEventListener('touchmove', this.onTouchMove);
    elemento.removeEventListener('touchend', this.onTouchEnd);
    elemento.removeEventListener('touchcancel', this.onTouchEnd);
  }

  sair(): void {
    this.authService.sair();
    this.router.navigate(['/login']);
  }

  alternarTema(): void {
    this.temaService.alternar();
  }

  private tratarTouchStart(evento: TouchEvent): void {
    this.comTransicao = false;
    this.eixoDecidido = false;
    this.ehSwipeHorizontal = false;
    this.deslocamentoAtual = 0;

    const rotaAtual = this.router.url.split('?')[0];
    const larguraTela = window.innerWidth;
    const toque = evento.touches[0];

    this.gestoIgnorado =
      larguraTela > LARGURA_MAXIMA_MOBILE
      || !ORDEM_NAVEGACAO.includes(rotaAtual)
      || toque.clientX < MARGEM_BORDA_IGNORADA
      || toque.clientX > larguraTela - MARGEM_BORDA_IGNORADA
      || this.dentroDeScrollHorizontalProprio(evento.target as HTMLElement | null);

    if (this.gestoIgnorado) {
      return;
    }
    this.touchStartX = toque.clientX;
    this.touchStartY = toque.clientY;
  }

  private tratarTouchMove(evento: TouchEvent): void {
    if (this.gestoIgnorado) {
      return;
    }
    const toque = evento.touches[0];
    const deltaX = toque.clientX - this.touchStartX;
    const deltaY = toque.clientY - this.touchStartY;

    if (!this.eixoDecidido) {
      if (Math.abs(deltaX) < LIMIAR_DECISAO_EIXO && Math.abs(deltaY) < LIMIAR_DECISAO_EIXO) {
        return;
      }
      this.eixoDecidido = true;
      this.ehSwipeHorizontal = Math.abs(deltaX) > Math.abs(deltaY) * PROPORCAO_MINIMA_HORIZONTAL;
      if (!this.ehSwipeHorizontal) {
        // É rolagem vertical normal - não mexe mais nesse gesto, deixa o
        // navegador rolar a página como sempre.
        this.gestoIgnorado = true;
        return;
      }
    }

    if (!this.ehSwipeHorizontal) {
      return;
    }
    evento.preventDefault();
    this.deslocamentoAtual = deltaX * AMORTECIMENTO_VISUAL;
  }

  private tratarTouchEnd(): void {
    if (this.gestoIgnorado || !this.ehSwipeHorizontal) {
      this.gestoIgnorado = false;
      this.ehSwipeHorizontal = false;
      return;
    }

    const deltaReal = this.deslocamentoAtual / AMORTECIMENTO_VISUAL;
    this.ehSwipeHorizontal = false;
    this.comTransicao = true;
    this.deslocamentoAtual = 0;

    if (Math.abs(deltaReal) >= LIMIAR_NAVEGACAO) {
      // Arrastou pra esquerda (delta negativo) -> próxima seção; pra direita -> anterior.
      this.navegarPorSwipe(deltaReal < 0 ? 1 : -1);
    }
  }

  private navegarPorSwipe(direcao: 1 | -1): void {
    const rotaAtual = this.router.url.split('?')[0];
    const indiceAtual = ORDEM_NAVEGACAO.indexOf(rotaAtual);
    if (indiceAtual === -1) {
      return;
    }
    const proximoIndice = indiceAtual + direcao;
    if (proximoIndice < 0 || proximoIndice >= ORDEM_NAVEGACAO.length) {
      return;
    }
    this.router.navigateByUrl(ORDEM_NAVEGACAO[proximoIndice]);
  }

  // Não intercepta o gesto se ele começar dentro de um elemento com scroll
  // horizontal próprio (ex: uma tabela larga que ainda use overflow-x: auto
  // em alguma tela) - deixa o scroll nativo dele agir normalmente.
  private dentroDeScrollHorizontalProprio(elemento: HTMLElement | null): boolean {
    const raiz = this.conteudoRef?.nativeElement ?? null;
    let atual = elemento;
    let profundidade = 0;
    while (atual && atual !== raiz && profundidade < 8) {
      if (atual.scrollWidth > atual.clientWidth + 1) {
        const overflowX = getComputedStyle(atual).overflowX;
        if (overflowX === 'auto' || overflowX === 'scroll') {
          return true;
        }
      }
      atual = atual.parentElement;
      profundidade++;
    }
    return false;
  }
}
