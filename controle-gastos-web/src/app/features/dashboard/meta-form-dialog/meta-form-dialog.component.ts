import { Component, Inject, inject } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';

import { MetaRequest } from '../../../models/meta.model';
import { MascaraMoedaDirective } from '../../../shared/mascara-moeda.directive';

export interface MetaFormDialogData {
  mes: number;
  ano: number;
  nomeMes: string;
  valorMetaAtual: number | null;
}

@Component({
  selector: 'app-meta-form-dialog',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    MatDialogModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MascaraMoedaDirective
  ],
  templateUrl: './meta-form-dialog.component.html',
  styleUrl: './meta-form-dialog.component.css'
})
export class MetaFormDialogComponent {

  private readonly fb = inject(FormBuilder);

  readonly form = this.fb.group({
    valorMeta: [null as number | null, [Validators.required, Validators.min(0.01)]]
  });

  constructor(
    private readonly dialogRef: MatDialogRef<MetaFormDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: MetaFormDialogData
  ) {
    if (data.valorMetaAtual != null) {
      this.form.patchValue({ valorMeta: data.valorMetaAtual });
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
    const meta: MetaRequest = {
      mes: this.data.mes,
      ano: this.data.ano,
      valorMeta: this.form.getRawValue().valorMeta!
    };
    this.dialogRef.close(meta);
  }
}
