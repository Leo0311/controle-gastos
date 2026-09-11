import { Component } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { RouterLink } from '@angular/router';

import { EmptyStateComponent } from '../../shared/empty-state/empty-state.component';

// Alvo da rota coringa (**, sempre a última em app.routes.ts) - qualquer URL que
// não bata com nenhuma rota conhecida cai aqui em vez de deixar o Angular Router
// lançar NG04002 no console e a área de conteúdo em branco (achado da varredura
// Playwright de 2026-09-10).
@Component({
  selector: 'app-pagina-nao-encontrada',
  standalone: true,
  imports: [EmptyStateComponent, MatButtonModule, RouterLink],
  templateUrl: './pagina-nao-encontrada.component.html',
  styleUrl: './pagina-nao-encontrada.component.css'
})
export class PaginaNaoEncontradaComponent {
}
