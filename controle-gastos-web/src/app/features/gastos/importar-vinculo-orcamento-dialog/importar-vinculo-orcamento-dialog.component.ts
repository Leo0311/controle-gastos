import { CurrencyPipe } from '@angular/common';
import { Component, Inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatDialogModule, MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { MatTableModule } from '@angular/material/table';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { MatButtonModule } from '@angular/material/button';

import { LinhaImportacao } from '../../../core/xlsx-importer';
import { Orcamento } from '../../../models/orcamento.model';

export interface VinculoImportacao {
  linha: LinhaImportacao;
  /** Orçamentos do mesmo mês/ano da linha, disponíveis para escolha (não só o que bate a categoria). */
  opcoes: Orcamento[];
  orcamentoId: number | null;
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
  imports: [
    CurrencyPipe,
    FormsModule,
    MatDialogModule,
    MatTableModule,
    MatFormFieldModule,
    MatSelectModule,
    MatButtonModule
  ],
  templateUrl: './importar-vinculo-orcamento-dialog.component.html',
  styleUrl: './importar-vinculo-orcamento-dialog.component.css'
})
export class ImportarVinculoOrcamentoDialogComponent {

  readonly colunas = ['linha', 'descricao', 'valor', 'orcamento'];

  constructor(
    private readonly dialogRef: MatDialogRef<ImportarVinculoOrcamentoDialogComponent, DecisaoVinculo[]>,
    @Inject(MAT_DIALOG_DATA) public dados: ImportarVinculoOrcamentoDialogData
  ) { }

  pular(): void {
    this.dialogRef.close([]);
  }

  confirmar(): void {
    const decisoes = this.dados.vinculos
      .filter((v) => v.orcamentoId != null)
      .map((v) => ({ linhaNumero: v.linha.linha, orcamentoId: v.orcamentoId! }));
    this.dialogRef.close(decisoes);
  }
}
