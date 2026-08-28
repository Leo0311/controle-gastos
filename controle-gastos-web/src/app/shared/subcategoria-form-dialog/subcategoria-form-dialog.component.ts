import { Component, Inject, inject } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';

import { Subcategoria } from '../../models/categoria.model';

export interface SubcategoriaFormDialogData {
  categoriaNome: string;
  subcategoria?: Subcategoria | null;
}

@Component({
  selector: 'app-subcategoria-form-dialog',
  standalone: true,
  imports: [ReactiveFormsModule, MatDialogModule, MatFormFieldModule, MatInputModule, MatButtonModule],
  templateUrl: './subcategoria-form-dialog.component.html',
  styleUrl: './subcategoria-form-dialog.component.css'
})
export class SubcategoriaFormDialogComponent {

  private readonly fb = inject(FormBuilder);

  readonly editando: boolean;

  readonly form = this.fb.group({
    nome: ['', [Validators.required, Validators.maxLength(60)]]
  });

  constructor(
    private readonly dialogRef: MatDialogRef<SubcategoriaFormDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: SubcategoriaFormDialogData
  ) {
    this.editando = !!data.subcategoria;
    if (data.subcategoria) {
      this.form.patchValue({ nome: data.subcategoria.nome });
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
    this.dialogRef.close(this.form.getRawValue().nome!.trim());
  }
}
