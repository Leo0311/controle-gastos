import { Component, EventEmitter, Input, OnChanges, Output, SimpleChanges } from '@angular/core';
import { CurrencyPipe } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { MatExpansionModule } from '@angular/material/expansion';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';

import { EmptyStateComponent } from '../../../shared/empty-state/empty-state.component';
import { ErroCarregamentoComponent } from '../../../shared/erro-carregamento/erro-carregamento.component';
import { GrupoMesCalendario, formatarDiaMes } from '../proximas-contas';

/**
 * Aba "Próximas contas" (achado M8). O componente pai carrega os gastos e monta o
 * `calendario` (ver proximas-contas.ts); aqui fica só a janela de meses visíveis
 * (uma parcelada de 120x são 120 mat-expansion-panel - renderizar todos de uma
 * vez trava a rolagem) e a view.
 */
@Component({
  selector: 'app-proximas-contas',
  standalone: true,
  imports: [
    CurrencyPipe,
    MatButtonModule,
    MatExpansionModule,
    MatProgressSpinnerModule,
    EmptyStateComponent,
    ErroCarregamentoComponent
  ],
  templateUrl: './proximas-contas.component.html',
  styleUrls: ['./proximas-contas.component.css', '../aba-comum.css']
})
export class ProximasContasComponent implements OnChanges {

  // calendario = todos os meses (o pai já monta tudo; o agrupamento é no cliente).
  @Input() calendario: GrupoMesCalendario[] = [];
  @Input() carregando = false;
  @Input() erro = false;
  @Output() tentarNovamente = new EventEmitter<void>();

  // calendarioVisivel = só a janela renderizada - não muda tráfego nem tempo de
  // resposta, só o que vai pro DOM.
  calendarioVisivel: GrupoMesCalendario[] = [];
  mesesRestantes = 0;
  proximoBloco = 0;
  private readonly INCREMENTO_MESES = 12;
  private mesesVisiveis = this.INCREMENTO_MESES;

  protected readonly formatarDiaMes = formatarDiaMes;

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['calendario']) {
      // Lista nova (primeira carga ou recarga) reinicia a janela nos 12 primeiros
      // meses, igual ao carregarCalendario original.
      this.mesesVisiveis = this.INCREMENTO_MESES;
      this.atualizarJanela();
    }
  }

  // Recorta calendario na janela atual e recalcula quanto ainda falta. Os meses
  // revelados entram DEPOIS do botão (que fica no fim da lista), então a rolagem
  // não pula: o conteúdo acima do ponto de scroll não muda, o botão só desce.
  private atualizarJanela(): void {
    this.calendarioVisivel = this.calendario.slice(0, this.mesesVisiveis);
    this.mesesRestantes = Math.max(0, this.calendario.length - this.mesesVisiveis);
    this.proximoBloco = Math.min(this.INCREMENTO_MESES, this.mesesRestantes);
  }

  verMaisMeses(): void {
    this.mesesVisiveis += this.INCREMENTO_MESES;
    this.atualizarJanela();
  }

  verTodosOsMeses(): void {
    this.mesesVisiveis = this.calendario.length;
    this.atualizarJanela();
  }
}
