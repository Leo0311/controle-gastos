import { Component, Inject, OnInit } from '@angular/core';
import { CurrencyPipe, DatePipe } from '@angular/common';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatChipsModule } from '@angular/material/chips';
import { MatExpansionModule } from '@angular/material/expansion';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';

import { CompraParceladaService } from '../../../services/compra-parcelada.service';
import { CompraParceladaDetalhe } from '../../../models/compra-parcelada.model';
import { EmptyStateComponent } from '../../../shared/empty-state/empty-state.component';
import { ErroCarregamentoComponent } from '../../../shared/erro-carregamento/erro-carregamento.component';
import { GrupoParcelas, GrupoRestante, agruparPorAno, deveAgruparPorAno } from '../compra-parcelada-detalhe';
import { classeStatus, hojeIso, rotuloStatus, statusDaConta } from '../../../core/status-conta';

export interface CompraParceladaDetalheDialogData {
  compraParceladaId: number;
}

/**
 * "Ver detalhe" de uma compra parcelada (aba Parceladas, menu "⋮"): progresso de
 * pagamento, valor pago/restante em R$, e a lista de parcelas - agrupada por ano
 * civil quando o parcelamento é longo (> 12x), plana quando é curto (ver
 * compra-parcelada-detalhe.ts). SÓ VISUALIZAÇÃO - marcar parcela como paga
 * continua em Gastos/Recorrentes, não aqui.
 */
@Component({
  selector: 'app-compra-parcelada-detalhe-dialog',
  standalone: true,
  imports: [
    CurrencyPipe,
    DatePipe,
    MatDialogModule,
    MatButtonModule,
    MatChipsModule,
    MatExpansionModule,
    MatProgressBarModule,
    MatProgressSpinnerModule,
    EmptyStateComponent,
    ErroCarregamentoComponent
  ],
  templateUrl: './compra-parcelada-detalhe-dialog.component.html',
  styleUrl: './compra-parcelada-detalhe-dialog.component.css'
})
export class CompraParceladaDetalheDialogComponent implements OnInit {

  detalhe: CompraParceladaDetalhe | null = null;
  grupos: GrupoParcelas[] = [];
  carregando = true;
  erro = false;

  protected readonly rotuloStatus = rotuloStatus;
  protected readonly classeStatus = classeStatus;
  protected readonly statusDaConta = statusDaConta;

  constructor(
    private readonly compraParceladaService: CompraParceladaService,
    private readonly dialogRef: MatDialogRef<CompraParceladaDetalheDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: CompraParceladaDetalheDialogData
  ) { }

  ngOnInit(): void {
    this.carregar();
  }

  carregar(): void {
    this.carregando = true;
    this.erro = false;
    this.compraParceladaService.detalhe(this.data.compraParceladaId).subscribe({
      next: (detalhe) => {
        this.detalhe = detalhe;
        this.grupos = deveAgruparPorAno(detalhe.numeroParcelas)
          ? agruparPorAno(detalhe.parcelas, hojeIso())
          : [];
        this.carregando = false;
      },
      error: () => {
        this.detalhe = null;
        this.carregando = false;
        this.erro = true;
      }
    });
  }

  // true = lista em painéis por ano (mat-accordion); false = lista plana. Mesmo
  // detalhe.numeroParcelas usado ao montar this.grupos - não recalcula com outra
  // regra.
  get agrupaPorAno(): boolean {
    return this.detalhe != null && deveAgruparPorAno(this.detalhe.numeroParcelas);
  }

  get percentualPago(): number {
    if (!this.detalhe || this.detalhe.valorTotal <= 0) {
      return 0;
    }
    return Math.min(100, (this.detalhe.valorPago / this.detalhe.valorTotal) * 100);
  }

  // "mais X ano(s) e Y mês(es)" pro bucket 'restante' - cuida do singular/plural
  // e omite a unidade zerada (24 meses -> só "mais 2 anos", 1 mês -> só "mais 1
  // mês", nunca "0 anos"/"0 meses"). Calculado aqui (não no template) pra evitar
  // a fragilidade de espalhar @if dentro de texto interpolado.
  rotuloRestante(grupo: GrupoRestante): string {
    const partes: string[] = [];
    if (grupo.anos > 0) {
      partes.push(`${grupo.anos} ano${grupo.anos > 1 ? 's' : ''}`);
    }
    if (grupo.meses > 0) {
      partes.push(`${grupo.meses} ${grupo.meses > 1 ? 'meses' : 'mês'}`);
    }
    return `mais ${partes.join(' e ')}`;
  }

  fechar(): void {
    this.dialogRef.close();
  }
}
