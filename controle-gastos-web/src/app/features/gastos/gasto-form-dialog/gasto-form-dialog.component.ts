import { AsyncPipe, CurrencyPipe } from '@angular/common';
import { Component, Inject, inject, OnInit } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatSelectModule, MatSelectChange } from '@angular/material/select';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { BreakpointObserver, Breakpoints } from '@angular/cdk/layout';
import { map } from 'rxjs';

import { Gasto } from '../../../models/gasto.model';
import { Orcamento } from '../../../models/orcamento.model';
import { OrcamentoService } from '../../../services/orcamento.service';
import { MascaraMoedaDirective } from '../../../shared/mascara-moeda.directive';

export interface GastoFormDialogData {
  gasto: Gasto | null;
}

@Component({
  selector: 'app-gasto-form-dialog',
  standalone: true,
  imports: [
    AsyncPipe,
    CurrencyPipe,
    ReactiveFormsModule,
    MatDialogModule,
    MatFormFieldModule,
    MatInputModule,
    MatDatepickerModule,
    MatSelectModule,
    MatButtonModule,
    MatIconModule,
    MatTooltipModule,
    MascaraMoedaDirective
  ],
  templateUrl: './gasto-form-dialog.component.html',
  styleUrl: './gasto-form-dialog.component.css'
})
export class GastoFormDialogComponent implements OnInit {

  private readonly fb = inject(FormBuilder);
  private readonly orcamentoService = inject(OrcamentoService);
  private readonly breakpointObserver = inject(BreakpointObserver);

  // Em telas pequenas, o datepicker abre em modo touch (calendário em tela cheia,
  // mais fácil de usar com o dedo) em vez do pequeno popup ancorado no input.
  readonly telaPequena$ = this.breakpointObserver.observe(Breakpoints.Handset)
    .pipe(map((resultado) => resultado.matches));

  readonly editando: boolean;

  /** Enquanto false, o orçamento selecionado é recalculado automaticamente conforme categoria/data mudam. */
  private escolhaManual: boolean;

  private todosOrcamentos: Orcamento[] = [];
  opcoesOrcamento: Orcamento[] = [];

  readonly form = this.fb.group({
    descricao: ['', [Validators.required, Validators.maxLength(150)]],
    valor: [null as number | null, [Validators.required, Validators.min(0.01)]],
    categoria: ['', [Validators.required, Validators.maxLength(60)]],
    data: [new Date(), [Validators.required]],
    orcamentoId: [null as number | null]
  });

  constructor(
    private readonly dialogRef: MatDialogRef<GastoFormDialogComponent>,
    @Inject(MAT_DIALOG_DATA) data: GastoFormDialogData
  ) {
    this.editando = !!data.gasto;
    // Editando um gasto existente: respeita o vínculo já salvo (inclusive se estiver em branco)
    // em vez de forçar uma nova sugestão automática.
    this.escolhaManual = this.editando;

    if (data.gasto) {
      this.form.patchValue({
        descricao: data.gasto.descricao,
        valor: data.gasto.valor,
        categoria: data.gasto.categoria,
        data: this.parseDataLocal(data.gasto.data),
        orcamentoId: data.gasto.orcamentoId ?? null
      });
    }
  }

  ngOnInit(): void {
    this.orcamentoService.listarTodos().subscribe({
      next: (orcamentos) => {
        this.todosOrcamentos = orcamentos;
        this.atualizarOpcoesOrcamento();
      },
      error: () => { /* a lista de orçamentos é auxiliar; sem ela o campo apenas fica vazio */ }
    });

    this.form.controls.categoria.valueChanges.subscribe(() => this.atualizarOpcoesOrcamento());
    this.form.controls.data.valueChanges.subscribe(() => this.atualizarOpcoesOrcamento());
  }

  onOrcamentoSelecionadoManualmente(_evento: MatSelectChange): void {
    this.escolhaManual = true;
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
    const gasto: Gasto = {
      descricao: valores.descricao!.trim(),
      valor: valores.valor!,
      categoria: valores.categoria!.trim(),
      data: this.formatarDataIso(valores.data!),
      orcamentoId: valores.orcamentoId ?? null
    };
    this.dialogRef.close(gasto);
  }

  private atualizarOpcoesOrcamento(): void {
    const data = this.form.controls.data.value;
    if (!data) {
      this.opcoesOrcamento = [];
      return;
    }

    const mes = data.getMonth() + 1;
    const ano = data.getFullYear();
    this.opcoesOrcamento = this.todosOrcamentos
      .filter((o) => o.mes === mes && o.ano === ano)
      .sort((a, b) => a.categoria.localeCompare(b.categoria));

    if (this.escolhaManual) {
      return;
    }

    const categoria = (this.form.controls.categoria.value ?? '').trim().toLowerCase();
    const correspondente = this.opcoesOrcamento.find((o) => o.categoria.toLowerCase() === categoria);
    this.form.controls.orcamentoId.setValue(correspondente?.id ?? null);
  }

  private parseDataLocal(iso: string): Date {
    const [ano, mes, dia] = iso.split('-').map(Number);
    return new Date(ano, mes - 1, dia);
  }

  private formatarDataIso(data: Date): string {
    const ano = data.getFullYear();
    const mes = String(data.getMonth() + 1).padStart(2, '0');
    const dia = String(data.getDate()).padStart(2, '0');
    return `${ano}-${mes}-${dia}`;
  }
}
