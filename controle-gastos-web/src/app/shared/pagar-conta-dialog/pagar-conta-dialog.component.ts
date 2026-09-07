import { AsyncPipe } from '@angular/common';
import { Component, Inject, inject } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatButtonModule } from '@angular/material/button';
import { BreakpointObserver, Breakpoints } from '@angular/cdk/layout';
import { map } from 'rxjs';

import { MascaraMoedaDirective } from '../mascara-moeda.directive';
import { MascaraDataDirective } from '../mascara-data.directive';

export interface PagarContaDialogData {
  // "Marcar como paga" ou "Editar pagamento" - o mesmo fluxo serve pros dois.
  titulo: string;
  descricao: string;
  // Valor previsto (recorrência/parcela) que pré-preenche o campo, editável.
  valorPrevisto: number;
  // Data que pré-preenche o campo (hoje ao pagar; a data do pagamento ao editar).
  dataInicial: Date;
}

export interface PagarContaResultado {
  valor: number;
  data: string; // ISO yyyy-MM-dd
}

/**
 * Diálogo de confirmação de pagamento de uma conta (gasto de recorrência ou
 * parcela). Valor pré-preenchido com o previsto e data com hoje, ambos editáveis.
 * Não faz a chamada à API - devolve {valor, data} pro chamador.
 */
@Component({
  selector: 'app-pagar-conta-dialog',
  standalone: true,
  imports: [
    AsyncPipe,
    ReactiveFormsModule,
    MatDialogModule,
    MatFormFieldModule,
    MatInputModule,
    MatDatepickerModule,
    MatButtonModule,
    MascaraMoedaDirective,
    MascaraDataDirective
  ],
  templateUrl: './pagar-conta-dialog.component.html',
  styleUrl: './pagar-conta-dialog.component.css'
})
export class PagarContaDialogComponent {

  private readonly fb = inject(FormBuilder);
  private readonly breakpointObserver = inject(BreakpointObserver);

  readonly telaPequena$ = this.breakpointObserver.observe(Breakpoints.Handset)
    .pipe(map((resultado) => resultado.matches));

  readonly titulo: string;
  readonly descricao: string;

  readonly form = this.fb.group({
    valor: [null as number | null, [Validators.required, Validators.min(0.01)]],
    data: [null as Date | null, [Validators.required]]
  });

  constructor(
    private readonly dialogRef: MatDialogRef<PagarContaDialogComponent, PagarContaResultado>,
    @Inject(MAT_DIALOG_DATA) data: PagarContaDialogData
  ) {
    this.titulo = data.titulo;
    this.descricao = data.descricao;
    this.form.patchValue({ valor: data.valorPrevisto, data: data.dataInicial });
  }

  cancelar(): void {
    this.dialogRef.close();
  }

  confirmar(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const { valor, data } = this.form.getRawValue();
    this.dialogRef.close({ valor: valor!, data: this.formatarDataIso(data!) });
  }

  private formatarDataIso(data: Date): string {
    const ano = data.getFullYear();
    const mes = String(data.getMonth() + 1).padStart(2, '0');
    const dia = String(data.getDate()).padStart(2, '0');
    return `${ano}-${mes}-${dia}`;
  }
}
