import { Component, EventEmitter, OnDestroy, OnInit, Output, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { Subscription } from 'rxjs';

import { GoogleSignInService } from '../../services/google-sign-in.service';

/**
 * Botão "Continuar com o Google", com o estilo outline do resto do app (não o
 * botão que o próprio Google renderiza, que só aceita customizar
 * tema/tamanho/formato/texto - ver investigação da feature). Quem aciona o
 * fluxo de verdade é o GoogleSignInService; este componente só sabe emitir
 * (credencial) com o ID token em caso de sucesso e (erro) com uma mensagem
 * pronta pra mostrar ao usuário - login/cadastro reagem igual ao que já fazem
 * com AuthService.login()/cadastrar().
 */
@Component({
  selector: 'app-google-sign-in-button',
  standalone: true,
  imports: [MatButtonModule],
  templateUrl: './google-sign-in-button.component.html',
  styleUrl: './google-sign-in-button.component.css'
})
export class GoogleSignInButtonComponent implements OnInit, OnDestroy {

  private readonly googleSignIn = inject(GoogleSignInService);
  private readonly inscricoes = new Subscription();

  @Output() readonly credencial = new EventEmitter<string>();
  @Output() readonly erro = new EventEmitter<string>();

  ngOnInit(): void {
    this.inscricoes.add(this.googleSignIn.credencial$.subscribe((idToken) => this.credencial.emit(idToken)));
    this.inscricoes.add(this.googleSignIn.erro$.subscribe((mensagem) => this.erro.emit(mensagem)));
  }

  ngOnDestroy(): void {
    this.inscricoes.unsubscribe();
  }

  clicar(): void {
    this.googleSignIn.solicitarLogin();
  }
}
