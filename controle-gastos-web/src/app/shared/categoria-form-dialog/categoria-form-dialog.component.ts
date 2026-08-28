import { Component, Inject, inject } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';

import { Categoria } from '../../models/categoria.model';

export interface CategoriaFormDialogData {
  categoria?: Categoria | null;
}

// Paleta curada só para dar um ponto de partida rápido no clique - o campo de
// texto ao lado aceita qualquer emoji digitado ou colado, sem ficar preso a ela.
// Não tem relação com o emoji das categorias padrão do sistema (esses ficam
// fixos, definidos na migração do banco em schema.sql) - só afeta a lista de
// sugestões ao criar/editar uma categoria ou subcategoria personalizada.
const PALETA_EMOJI = [
  '🍽️', '🍔', '🍕', '☕', '🛒', '🚗', '🚌', '🚕', '🚲', '⛽',
  '🏠', '🏥', '💊', '📚', '🎓', '🎮', '🎬', '🎵', '⚽', '✈️',
  '🏖️', '👕', '👟', '💡', '📱', '💻', '🐶', '🐱', '🎁', '💰',
  '💳', '📦',
  '💸', '💵', '🏦', '📈', '🧾', '💼', '💑', '🏋️', '🍺', '🧴', '🛠️', '🎂', '🎫'
];

@Component({
  selector: 'app-categoria-form-dialog',
  standalone: true,
  imports: [ReactiveFormsModule, MatDialogModule, MatFormFieldModule, MatInputModule, MatButtonModule],
  templateUrl: './categoria-form-dialog.component.html',
  styleUrl: './categoria-form-dialog.component.css'
})
export class CategoriaFormDialogComponent {

  private readonly fb = inject(FormBuilder);

  readonly paletaEmoji = PALETA_EMOJI;
  readonly editando: boolean;

  readonly form = this.fb.group({
    nome: ['', [Validators.required, Validators.maxLength(60)]],
    emoji: ['📁', [Validators.required, Validators.maxLength(16)]]
  });

  constructor(
    private readonly dialogRef: MatDialogRef<CategoriaFormDialogComponent>,
    @Inject(MAT_DIALOG_DATA) data: CategoriaFormDialogData
  ) {
    this.editando = !!data.categoria;
    if (data.categoria) {
      this.form.patchValue({ nome: data.categoria.nome, emoji: data.categoria.emoji });
    }
  }

  escolherEmoji(emoji: string): void {
    this.form.controls.emoji.setValue(emoji);
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
    const categoria: Categoria = {
      nome: valores.nome!.trim(),
      emoji: valores.emoji!.trim()
    };
    this.dialogRef.close(categoria);
  }
}
