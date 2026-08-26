import { Component, Inject, inject } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatButtonModule } from '@angular/material/button';

import { Orcamento } from '../../../models/orcamento.model';

export interface OrcamentoFormDialogData {
  mes: number;
  ano: number;
  orcamento?: Orcamento | null;
}

@Component({
  selector: 'app-orcamento-form-dialog',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    MatDialogModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatButtonModule
  ],
  templateUrl: './orcamento-form-dialog.component.html',
  styleUrl: './orcamento-form-dialog.component.css'
})
export class OrcamentoFormDialogComponent {

  private readonly fb = inject(FormBuilder);

  readonly meses = [
    { valor: 1, nome: 'Janeiro' }, { valor: 2, nome: 'Fevereiro' }, { valor: 3, nome: 'Março' },
    { valor: 4, nome: 'Abril' }, { valor: 5, nome: 'Maio' }, { valor: 6, nome: 'Junho' },
    { valor: 7, nome: 'Julho' }, { valor: 8, nome: 'Agosto' }, { valor: 9, nome: 'Setembro' },
    { valor: 10, nome: 'Outubro' }, { valor: 11, nome: 'Novembro' }, { valor: 12, nome: 'Dezembro' }
  ];

  readonly editando: boolean;

  readonly form = this.fb.group({
    categoria: ['', [Validators.required, Validators.maxLength(60)]],
    valorLimite: [null as number | null, [Validators.required, Validators.min(0.01)]],
    mes: [1, [Validators.required]],
    ano: [new Date().getFullYear(), [Validators.required, Validators.min(2000)]]
  });

  constructor(
    private readonly dialogRef: MatDialogRef<OrcamentoFormDialogComponent>,
    @Inject(MAT_DIALOG_DATA) data: OrcamentoFormDialogData
  ) {
    this.editando = !!data.orcamento;
    if (data.orcamento) {
      this.form.patchValue({
        categoria: data.orcamento.categoria,
        valorLimite: data.orcamento.valorLimite,
        mes: data.orcamento.mes,
        ano: data.orcamento.ano
      });
    } else {
      this.form.patchValue({ mes: data.mes, ano: data.ano });
    }
  }

  cancelar(): void {
    this.dialogRef.close();
  }

  salvar(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const valores = this.form.getRawValue();
    const orcamento: Orcamento = {
      categoria: valores.categoria!.trim(),
      valorLimite: valores.valorLimite!,
      mes: valores.mes!,
      ano: valores.ano!
    };
    this.dialogRef.close(orcamento);
  }
}
