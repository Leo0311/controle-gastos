import { Component, inject } from '@angular/core';
import { AbstractControl, FormBuilder, ReactiveFormsModule, ValidationErrors, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';

import { AuthService } from '../../../services/auth.service';

function senhasIguaisValidator(control: AbstractControl): ValidationErrors | null {
  const senha = control.get('senha')?.value;
  const confirmarSenha = control.get('confirmarSenha')?.value;
  return senha && confirmarSenha && senha !== confirmarSenha ? { senhasDiferentes: true } : null;
}

@Component({
  selector: 'app-cadastro',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    RouterLink,
    MatCardModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatIconModule,
    MatProgressSpinnerModule,
    MatSnackBarModule
  ],
  templateUrl: './cadastro.component.html',
  styleUrl: './cadastro.component.css'
})
export class CadastroComponent {
  private readonly fb = inject(FormBuilder);
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);
  private readonly snackBar = inject(MatSnackBar);

  carregando = false;
  esconderSenha = true;
  esconderConfirmarSenha = true;

  readonly form = this.fb.group({
    nome: ['', [Validators.required]],
    email: ['', [Validators.required, Validators.email]],
    senha: ['', [Validators.required, Validators.minLength(6)]],
    confirmarSenha: ['', [Validators.required]]
  }, { validators: senhasIguaisValidator });

  cadastrar(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.carregando = true;
    const { nome, email, senha } = this.form.getRawValue();

    this.authService.cadastrar({ nome: nome!, email: email!, senha: senha! }).subscribe({
      next: () => {
        this.carregando = false;
        this.router.navigate(['/dashboard']);
      },
      error: (erro) => {
        this.carregando = false;
        this.snackBar.open(this.mensagemErro(erro), 'Fechar', { duration: 5000 });
      }
    });
  }

  private mensagemErro(erro: unknown): string {
    const erroHttp = erro as { error?: { erro?: string } };
    return erroHttp?.error?.erro ?? 'Ocorreu um erro inesperado.';
  }
}
