import { Component, inject, OnInit } from '@angular/core';
import { AbstractControl, FormBuilder, ReactiveFormsModule, ValidationErrors, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';

import { AuthService } from '../../../services/auth.service';
import { NotificacaoService } from '../../../core/notificacao.service';

function senhasIguaisValidator(control: AbstractControl): ValidationErrors | null {
  const novaSenha = control.get('novaSenha')?.value;
  const confirmarNovaSenha = control.get('confirmarNovaSenha')?.value;
  return novaSenha && confirmarNovaSenha && novaSenha !== confirmarNovaSenha ? { senhasDiferentes: true } : null;
}

@Component({
  selector: 'app-redefinir-senha',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    RouterLink,
    MatCardModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatIconModule,
    MatProgressSpinnerModule
  ],
  templateUrl: './redefinir-senha.component.html',
  styleUrl: './redefinir-senha.component.css'
})
export class RedefinirSenhaComponent implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly notificacao = inject(NotificacaoService);

  carregando = false;
  esconderSenha = true;
  esconderConfirmarSenha = true;
  tokenAusente = false;
  private token = '';

  readonly form = this.fb.group({
    novaSenha: ['', [Validators.required, Validators.minLength(6)]],
    confirmarNovaSenha: ['', [Validators.required]]
  }, { validators: senhasIguaisValidator });

  ngOnInit(): void {
    this.token = this.route.snapshot.queryParamMap.get('token') ?? '';
    this.tokenAusente = !this.token;
  }

  redefinir(): void {
    if (this.form.invalid || this.tokenAusente) {
      this.form.markAllAsTouched();
      return;
    }

    this.carregando = true;
    const { novaSenha } = this.form.getRawValue();

    this.authService.redefinirSenha(this.token, novaSenha!).subscribe({
      next: () => {
        this.carregando = false;
        this.notificacao.mostrar('Senha redefinida com sucesso. Faça login com a nova senha.');
        this.router.navigate(['/login']);
      },
      error: (erro) => {
        this.carregando = false;
        this.notificacao.erro(this.notificacao.mensagemDeErro(erro));
      }
    });
  }
}
