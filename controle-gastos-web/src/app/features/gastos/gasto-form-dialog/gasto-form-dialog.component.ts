import { Component, Inject, inject } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatButtonModule } from '@angular/material/button';

import { Gasto } from '../../../models/gasto.model';

export interface GastoFormDialogData {
  gasto: Gasto | null;
}

@Component({
  selector: 'app-gasto-form-dialog',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    MatDialogModule,
    MatFormFieldModule,
    MatInputModule,
    MatDatepickerModule,
    MatButtonModule
  ],
  templateUrl: './gasto-form-dialog.component.html',
  styleUrl: './gasto-form-dialog.component.css'
})
export class GastoFormDialogComponent {

  private readonly fb = inject(FormBuilder);

  readonly editando: boolean;

  readonly form = this.fb.group({
    descricao: ['', [Validators.required, Validators.maxLength(150)]],
    valor: [null as number | null, [Validators.required, Validators.min(0.01)]],
    categoria: ['', [Validators.required, Validators.maxLength(60)]],
    data: [new Date(), [Validators.required]]
  });

  constructor(
    private readonly dialogRef: MatDialogRef<GastoFormDialogComponent>,
    @Inject(MAT_DIALOG_DATA) data: GastoFormDialogData
  ) {
    this.editando = !!data.gasto;
    if (data.gasto) {
      this.form.patchValue({
        descricao: data.gasto.descricao,
        valor: data.gasto.valor,
        categoria: data.gasto.categoria,
        data: this.parseDataLocal(data.gasto.data)
      });
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
    const gasto: Gasto = {
      descricao: valores.descricao!.trim(),
      valor: valores.valor!,
      categoria: valores.categoria!.trim(),
      data: this.formatarDataIso(valores.data!)
    };
    this.dialogRef.close(gasto);
  }

  private parseDataLocal(iso: string): Date {
    const [ano, mes, dia] = iso.split('-').map(Number);
    return new Date(ano, mes - 1, dia);
  }

  private formatarDataIso(data: Date): string {
    const ano = data.getFullYear();
    const mes = String(data.getMonth() + 1).padStart(2, '0');
    const dia = String(data.getDate()).padStart(2, '0');
    return `${ano}-${mes}-${dia}`;
  }
}
