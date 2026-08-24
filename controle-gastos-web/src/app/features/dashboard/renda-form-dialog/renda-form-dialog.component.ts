import { Component, Inject, inject } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';

export interface RendaFormDialogData {
  rendaAtual: number | null;
}

@Component({
  selector: 'app-renda-form-dialog',
  standalone: true,
  imports: [ReactiveFormsModule, MatDialogModule, MatFormFieldModule, MatInputModule, MatButtonModule],
  templateUrl: './renda-form-dialog.component.html',
  styleUrl: './renda-form-dialog.component.css'
})
export class RendaFormDialogComponent {

  private readonly fb = inject(FormBuilder);

  readonly form = this.fb.group({
    rendaMensal: [null as number | null, [Validators.required, Validators.min(0.01)]]
  });

  constructor(
    private readonly dialogRef: MatDialogRef<RendaFormDialogComponent>,
    @Inject(MAT_DIALOG_DATA) data: RendaFormDialogData
  ) {
    if (data.rendaAtual != null) {
      this.form.patchValue({ rendaMensal: data.rendaAtual });
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
    this.dialogRef.close(this.form.getRawValue().rendaMensal!);
  }
}
