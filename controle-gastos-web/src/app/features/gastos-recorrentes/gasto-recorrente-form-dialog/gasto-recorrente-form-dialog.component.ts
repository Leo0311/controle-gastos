import { CurrencyPipe } from '@angular/common';
import { Component, Inject, inject, OnInit } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialog, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule, MatSelectChange } from '@angular/material/select';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';

import { GastoRecorrente } from '../../../models/gasto-recorrente.model';
import { Orcamento } from '../../../models/orcamento.model';
import { Categoria, Subcategoria } from '../../../models/categoria.model';
import { OrcamentoService } from '../../../services/orcamento.service';
import { CategoriaService } from '../../../services/categoria.service';
import { MascaraMoedaDirective } from '../../../shared/mascara-moeda.directive';
import {
  CategoriaFormDialogComponent,
  CategoriaFormDialogData
} from '../../../shared/categoria-form-dialog/categoria-form-dialog.component';
import {
  SubcategoriaFormDialogComponent,
  SubcategoriaFormDialogData,
  SubcategoriaFormResultado
} from '../../../shared/subcategoria-form-dialog/subcategoria-form-dialog.component';

export interface GastoRecorrenteFormDialogData {
  recorrente: GastoRecorrente | null;
}

const NOVA_CATEGORIA = -1;
const NOVA_SUBCATEGORIA = -1;

@Component({
  selector: 'app-gasto-recorrente-form-dialog',
  standalone: true,
  imports: [
    CurrencyPipe,
    ReactiveFormsModule,
    MatDialogModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatButtonModule,
    MatIconModule,
    MascaraMoedaDirective
  ],
  templateUrl: './gasto-recorrente-form-dialog.component.html',
  styleUrl: './gasto-recorrente-form-dialog.component.css'
})
export class GastoRecorrenteFormDialogComponent implements OnInit {

  private readonly fb = inject(FormBuilder);
  private readonly orcamentoService = inject(OrcamentoService);
  private readonly categoriaService = inject(CategoriaService);
  private readonly dialog = inject(MatDialog);

  readonly editando: boolean;
  readonly NOVA_CATEGORIA = NOVA_CATEGORIA;
  readonly NOVA_SUBCATEGORIA = NOVA_SUBCATEGORIA;

  private categoriaAnterior: number | null;
  private subcategoriaAnterior: number | null;

  private todasCategorias: Categoria[] = [];
  private todasSubcategorias: Subcategoria[] = [];
  private todosOrcamentos: Orcamento[] = [];

  opcoesCategoria: Categoria[] = [];
  opcoesSubcategoria: Subcategoria[] = [];
  opcoesOrcamento: Orcamento[] = [];

  readonly form = this.fb.group({
    descricao: ['', [Validators.required, Validators.maxLength(150)]],
    valor: [null as number | null, [Validators.required, Validators.min(0.01)]],
    categoriaId: [null as number | null, [Validators.required]],
    subcategoriaId: [null as number | null],
    diaDoMes: [null as number | null, [Validators.required, Validators.min(1), Validators.max(31)]],
    orcamentoId: [null as number | null],
    // Quantos meses, a partir do atual, já lançar imediatamente ao salvar - em vez de
    // esperar o lançamento sob demanda de cada mês quando ele chegar (ver
    // GastoRecorrenteService.gerarProximosMeses). Padrão 12 tanto pra criar quanto
    // pra editar - não reflete nenhum valor já persistido (a API não guarda esse
    // campo, só usa como entrada), então não há um "horizonte atual" pra restaurar.
    mesesGerar: [12, [Validators.required, Validators.min(1), Validators.max(12)]]
  });

  constructor(
    private readonly dialogRef: MatDialogRef<GastoRecorrenteFormDialogComponent>,
    @Inject(MAT_DIALOG_DATA) data: GastoRecorrenteFormDialogData
  ) {
    this.editando = !!data.recorrente;
    this.categoriaAnterior = data.recorrente?.categoriaId ?? null;
    this.subcategoriaAnterior = data.recorrente?.subcategoriaId ?? null;

    if (data.recorrente) {
      this.form.patchValue({
        descricao: data.recorrente.descricao,
        valor: data.recorrente.valor,
        categoriaId: data.recorrente.categoriaId,
        subcategoriaId: data.recorrente.subcategoriaId ?? null,
        diaDoMes: data.recorrente.diaDoMes,
        orcamentoId: data.recorrente.orcamentoId ?? null
      });
    }
  }

  ngOnInit(): void {
    this.categoriaService.listarVisiveis().subscribe({
      next: (categorias) => {
        this.todasCategorias = categorias;
        this.opcoesCategoria = categorias;
      },
      error: () => { /* lista auxiliar; sem ela o dropdown só fica vazio */ }
    });
    this.categoriaService.listarTodasSubcategorias().subscribe({
      next: (subcategorias) => {
        this.todasSubcategorias = subcategorias;
        this.atualizarOpcoesSubcategoria();
      },
      error: () => { /* lista auxiliar */ }
    });
    this.orcamentoService.listarTodos().subscribe({
      next: (orcamentos) => {
        this.todosOrcamentos = orcamentos;
        this.atualizarOpcoesOrcamento();
      },
      error: () => { /* lista auxiliar */ }
    });
  }

  onCategoriaChange(evento: MatSelectChange): void {
    if (evento.value === NOVA_CATEGORIA) {
      this.form.controls.categoriaId.setValue(this.categoriaAnterior, { emitEvent: false });
      this.abrirNovaCategoria();
      return;
    }
    this.categoriaAnterior = evento.value;
    this.atualizarOpcoesSubcategoria();
    this.atualizarOpcoesOrcamento();
  }

  onSubcategoriaChange(evento: MatSelectChange): void {
    if (evento.value === NOVA_SUBCATEGORIA) {
      this.form.controls.subcategoriaId.setValue(this.subcategoriaAnterior, { emitEvent: false });
      this.abrirNovaSubcategoria();
      return;
    }
    this.subcategoriaAnterior = evento.value;
    this.atualizarOpcoesOrcamento();
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
    const recorrente: GastoRecorrente = {
      descricao: valores.descricao!.trim(),
      valor: valores.valor!,
      categoriaId: valores.categoriaId!,
      subcategoriaId: valores.subcategoriaId ?? null,
      diaDoMes: valores.diaDoMes!,
      orcamentoId: valores.orcamentoId ?? null,
      mesesGerar: valores.mesesGerar!
    };
    this.dialogRef.close(recorrente);
  }

  private abrirNovaCategoria(): void {
    const ref = this.dialog.open<CategoriaFormDialogComponent, CategoriaFormDialogData, Categoria>(
      CategoriaFormDialogComponent,
      { data: { categoria: null }, width: '420px', maxWidth: '95vw' }
    );
    ref.afterClosed().subscribe((resultado) => {
      if (!resultado) {
        return;
      }
      this.categoriaService.criar(resultado).subscribe({
        next: (categoria) => {
          this.todasCategorias = [...this.todasCategorias, categoria].sort((a, b) => a.nome.localeCompare(b.nome));
          this.opcoesCategoria = this.todasCategorias;
          this.categoriaAnterior = categoria.id!;
          this.form.controls.categoriaId.setValue(categoria.id!);
          this.atualizarOpcoesSubcategoria();
          this.atualizarOpcoesOrcamento();
        },
        error: () => { /* o formulário simplesmente continua com a categoria anterior */ }
      });
    });
  }

  private abrirNovaSubcategoria(): void {
    const categoriaId = this.form.controls.categoriaId.value;
    if (!categoriaId) {
      return;
    }
    const categoriaNome = this.todasCategorias.find((c) => c.id === categoriaId)?.nome ?? '';
    const ref = this.dialog.open<SubcategoriaFormDialogComponent, SubcategoriaFormDialogData, SubcategoriaFormResultado>(
      SubcategoriaFormDialogComponent,
      { data: { categoriaNome, subcategoria: null }, width: '420px', maxWidth: '95vw' }
    );
    ref.afterClosed().subscribe((resultado) => {
      if (!resultado) {
        return;
      }
      this.categoriaService.criarSubcategoria(categoriaId, resultado).subscribe({
        next: (subcategoria) => {
          this.todasSubcategorias = [...this.todasSubcategorias, subcategoria];
          this.subcategoriaAnterior = subcategoria.id!;
          this.atualizarOpcoesSubcategoria();
          this.form.controls.subcategoriaId.setValue(subcategoria.id!);
          this.atualizarOpcoesOrcamento();
        },
        error: () => { /* o formulário simplesmente continua sem a nova subcategoria */ }
      });
    });
  }

  private atualizarOpcoesSubcategoria(): void {
    const categoriaId = this.form.controls.categoriaId.value;
    this.opcoesSubcategoria = categoriaId
      ? this.todasSubcategorias.filter((s) => s.categoriaId === categoriaId)
      : [];

    const subcategoriaAtual = this.form.controls.subcategoriaId.value;
    if (subcategoriaAtual && !this.opcoesSubcategoria.some((s) => s.id === subcategoriaAtual)) {
      this.form.controls.subcategoriaId.setValue(null);
      this.subcategoriaAnterior = null;
    }
  }

  // Diferente do formulário de gasto avulso, aqui não há uma data específica pra
  // filtrar mes/ano do orçamento (a recorrência se repete todo mês) - lista todos os
  // orçamentos da categoria/subcategoria escolhida, mais recentes primeiro, e deixa
  // a escolha manual. O vínculo vale como está: se o orçamento escolhido for de um
  // mês específico, os lançamentos de outros meses continuam usando o mesmo vínculo.
  private atualizarOpcoesOrcamento(): void {
    const categoriaId = this.form.controls.categoriaId.value;
    if (!categoriaId) {
      this.opcoesOrcamento = [];
      this.form.controls.orcamentoId.setValue(null);
      return;
    }
    const subcategoriaId = this.form.controls.subcategoriaId.value;
    this.opcoesOrcamento = this.todosOrcamentos
      .filter((o) => o.categoriaId === categoriaId && (!subcategoriaId || o.subcategoriaId === subcategoriaId))
      .sort((a, b) => (b.ano - a.ano) || (b.mes - a.mes));

    const orcamentoAtual = this.form.controls.orcamentoId.value;
    if (orcamentoAtual && !this.opcoesOrcamento.some((o) => o.id === orcamentoAtual)) {
      this.form.controls.orcamentoId.setValue(null);
    }
  }
}
