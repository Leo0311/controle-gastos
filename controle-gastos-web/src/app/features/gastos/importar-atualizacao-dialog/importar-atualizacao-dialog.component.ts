import { Component, Inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatDialogModule, MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { MatTableModule } from '@angular/material/table';
import { MatCheckboxModule, MatCheckboxChange } from '@angular/material/checkbox';
import { MatButtonModule } from '@angular/material/button';

import { LinhaImportacao } from '../../../core/xlsx-importer';
import { Gasto } from '../../../models/gasto.model';

export interface AtualizacaoImportacao {
  linha: LinhaImportacao;
  existente: Gasto;
  atualizar: boolean;
}

export interface ImportarAtualizacaoDialogData {
  atualizacoes: AtualizacaoImportacao[];
}

export interface DecisaoAtualizacao {
  linha: LinhaImportacao;
  existente: Gasto;
}

@Component({
  selector: 'app-importar-atualizacao-dialog',
  standalone: true,
  imports: [FormsModule, MatDialogModule, MatTableModule, MatCheckboxModule, MatButtonModule],
  templateUrl: './importar-atualizacao-dialog.component.html',
  styleUrl: './importar-atualizacao-dialog.component.css'
})
export class ImportarAtualizacaoDialogComponent {

  readonly colunas = ['atualizar', 'id', 'descricao', 'valor', 'categoria', 'data'];

  todosMarcados = true;

  constructor(
    private readonly dialogRef: MatDialogRef<ImportarAtualizacaoDialogComponent, DecisaoAtualizacao[]>,
    @Inject(MAT_DIALOG_DATA) public dados: ImportarAtualizacaoDialogData
  ) { }

  alternarTodos(evento: MatCheckboxChange): void {
    this.todosMarcados = evento.checked;
    this.dados.atualizacoes.forEach((a) => (a.atualizar = evento.checked));
  }

  atualizarTodosMarcados(): void {
    this.todosMarcados = this.dados.atualizacoes.every((a) => a.atualizar);
  }

  formatarCampo(antigo: string, novo: string): string {
    return antigo === novo ? antigo : `${antigo} → ${novo}`;
  }

  formatarValor(valor: number): string {
    return valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  }

  formatarData(iso: string): string {
    const [ano, mes, dia] = iso.split('-');
    return `${dia}/${mes}/${ano}`;
  }

  pular(): void {
    this.dialogRef.close([]);
  }

  confirmar(): void {
    const decisoes = this.dados.atualizacoes
      .filter((a) => a.atualizar)
      .map((a) => ({ linha: a.linha, existente: a.existente }));
    this.dialogRef.close(decisoes);
  }
}
