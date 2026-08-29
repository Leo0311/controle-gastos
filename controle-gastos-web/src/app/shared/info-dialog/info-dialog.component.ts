import { Component, Inject } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';

export interface InfoDialogData {
  titulo: string;
  mensagem: string;
}

// Diálogo só de aviso (sem Cancelar/Confirmar, como o ConfirmDialogComponent) - usado
// quando não há uma decisão a tomar, só informação a mostrar (ex: instruções de
// instalação manual do PWA no iOS Safari).
@Component({
  selector: 'app-info-dialog',
  standalone: true,
  imports: [MatDialogModule, MatButtonModule],
  templateUrl: './info-dialog.component.html'
})
export class InfoDialogComponent {

  constructor(
    private readonly dialogRef: MatDialogRef<InfoDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: InfoDialogData
  ) { }

  fechar(): void {
    this.dialogRef.close();
  }
}
