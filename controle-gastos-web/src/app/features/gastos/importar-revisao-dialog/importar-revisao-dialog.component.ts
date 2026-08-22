import { Component, Inject } from '@angular/core';
import { MatDialogModule, MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { MatTableModule } from '@angular/material/table';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';

import { LinhaImportacao } from '../../../core/xlsx-importer';

export interface ImportarRevisaoDialogData {
  linhas: LinhaImportacao[];
}

@Component({
  selector: 'app-importar-revisao-dialog',
  standalone: true,
  imports: [MatDialogModule, MatTableModule, MatButtonModule, MatIconModule],
  templateUrl: './importar-revisao-dialog.component.html',
  styleUrl: './importar-revisao-dialog.component.css'
})
export class ImportarRevisaoDialogComponent {

  readonly colunas = ['status', 'linha', 'descricao', 'valor', 'categoria', 'data', 'erro'];

  readonly linhasValidas: LinhaImportacao[];
  readonly linhasInvalidas: LinhaImportacao[];

  constructor(
    private readonly dialogRef: MatDialogRef<ImportarRevisaoDialogComponent, LinhaImportacao[]>,
    @Inject(MAT_DIALOG_DATA) public dados: ImportarRevisaoDialogData
  ) {
    this.linhasValidas = dados.linhas.filter((l) => l.valido);
    this.linhasInvalidas = dados.linhas.filter((l) => !l.valido);
  }

  cancelar(): void {
    this.dialogRef.close();
  }

  confirmar(): void {
    this.dialogRef.close(this.linhasValidas);
  }
}
