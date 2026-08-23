import { CurrencyPipe } from '@angular/common';
import { Component, Inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatDialogModule, MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { MatTableModule } from '@angular/material/table';
import { MatCheckboxModule, MatCheckboxChange } from '@angular/material/checkbox';
import { MatButtonModule } from '@angular/material/button';

import { LinhaImportacao } from '../../../core/xlsx-importer';
import { Orcamento } from '../../../models/orcamento.model';

export interface VinculoImportacao {
  linha: LinhaImportacao;
  orcamento: Orcamento;
  vincular: boolean;
}

export interface ImportarVinculoOrcamentoDialogData {
  vinculos: VinculoImportacao[];
}

export interface DecisaoVinculo {
  linhaNumero: number;
  orcamentoId: number;
}

@Component({
  selector: 'app-importar-vinculo-orcamento-dialog',
  standalone: true,
  imports: [CurrencyPipe, FormsModule, MatDialogModule, MatTableModule, MatCheckboxModule, MatButtonModule],
  templateUrl: './importar-vinculo-orcamento-dialog.component.html',
  styleUrl: './importar-vinculo-orcamento-dialog.component.css'
})
export class ImportarVinculoOrcamentoDialogComponent {

  readonly colunas = ['vincular', 'linha', 'descricao', 'valor', 'orcamento'];

  todosMarcados = true;

  constructor(
    private readonly dialogRef: MatDialogRef<ImportarVinculoOrcamentoDialogComponent, DecisaoVinculo[]>,
    @Inject(MAT_DIALOG_DATA) public dados: ImportarVinculoOrcamentoDialogData
  ) { }

  alternarTodos(evento: MatCheckboxChange): void {
    this.todosMarcados = evento.checked;
    this.dados.vinculos.forEach((v) => (v.vincular = evento.checked));
  }

  atualizarTodosMarcados(): void {
    this.todosMarcados = this.dados.vinculos.every((v) => v.vincular);
  }

  pular(): void {
    this.dialogRef.close([]);
  }

  confirmar(): void {
    const decisoes = this.dados.vinculos
      .filter((v) => v.vincular)
      .map((v) => ({ linhaNumero: v.linha.linha, orcamentoId: v.orcamento.id! }));
    this.dialogRef.close(decisoes);
  }
}
