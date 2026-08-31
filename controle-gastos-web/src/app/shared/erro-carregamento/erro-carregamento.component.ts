import { Component, EventEmitter, Input, Output } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';

/**
 * Estado de erro de carregamento - mostrado no lugar do conteúdo (e do
 * empty-state) quando a chamada à API falha, para não parecer "sem dados"
 * quando na verdade houve uma falha. Contrapartida do EmptyStateComponent.
 */
@Component({
  selector: 'app-erro-carregamento',
  standalone: true,
  imports: [MatButtonModule, MatIconModule],
  templateUrl: './erro-carregamento.component.html',
  styleUrl: './erro-carregamento.component.css'
})
export class ErroCarregamentoComponent {

  /** Completa a frase "Não foi possível carregar {oQue}." (ex: "os gastos"). */
  @Input() oQue = 'os dados';

  /** Disparado ao clicar em "Tentar novamente" - a tela deve rechamar o carregamento. */
  @Output() tentarNovamente = new EventEmitter<void>();
}
