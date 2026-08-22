import { AsyncPipe } from '@angular/common';
import { Component, inject } from '@angular/core';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatTabsModule } from '@angular/material/tabs';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';

import { AuthService } from './services/auth.service';

const NOMES_MESES = [
  'janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho',
  'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'
];

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
export class AppComponent {
  title = 'controle-gastos-web';

  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);

  readonly usuario$ = this.authService.usuario$;
  readonly mesAnoAtual: string;

  constructor() {
    const hoje = new Date();
    const texto = `${NOMES_MESES[hoje.getMonth()]} de ${hoje.getFullYear()}`;
    this.mesAnoAtual = texto.charAt(0).toUpperCase() + texto.slice(1);
  }

  sair(): void {
    this.authService.sair();
    this.router.navigate(['/login']);
  }
}
