import { AsyncPipe, CurrencyPipe } from '@angular/common';
import { Component, Inject, inject, OnInit } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialog, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatSelectModule, MatSelectChange } from '@angular/material/select';
import { MatButtonModule } from '@angular/material/button';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { BreakpointObserver, Breakpoints } from '@angular/cdk/layout';
import { map } from 'rxjs';

import { Gasto } from '../../../models/gasto.model';
import { GastoRecorrente } from '../../../models/gasto-recorrente.model';
import { CompraParcelada } from '../../../models/compra-parcelada.model';
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
  SubcategoriaFormDialogData
} from '../../../shared/subcategoria-form-dialog/subcategoria-form-dialog.component';

export interface GastoFormDialogData {
  gasto: Gasto | null;
  // Pré-preenche um gasto NOVO (editando continua false, "Salvar" ainda cria em vez
  // de atualizar) com valores parciais - usado pelo fluxo de leitura de nota fiscal
  // (ver GastosComponent.escanearNotaFiscal), que só tem descrição/valor/data;
  // categoria/subcategoria/orçamento ficam em branco pro usuário escolher. Ignorado
  // quando `gasto` está presente (edição sempre usa os valores do gasto existente).
  valoresIniciais?: Pick<Gasto, 'descricao' | 'valor' | 'data'>;
}

// Quando "Tornar recorrente" ou "Parcelar compra" está marcado (mutuamente
// exclusivos - ver [disabled] no template), o formulário cria uma recorrência ou uma
// compra parcelada em vez de um gasto avulso - por isso o resultado do diálogo é uma
// dessas três formas, nunca mais de uma ao mesmo tempo.
export type GastoFormResultado =
  | { tipo: 'gasto'; gasto: Gasto }
  | { tipo: 'recorrente'; recorrente: GastoRecorrente }
  | { tipo: 'parcelada'; parcelada: CompraParcelada };

// Valor sentinela para a opção "+ Nova categoria/subcategoria..." no fim do
// dropdown - nunca corresponde a um ID real (IDs reais são sempre positivos).
const NOVA_CATEGORIA = -1;
const NOVA_SUBCATEGORIA = -1;

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
    MatCheckboxModule,
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
  private readonly categoriaService = inject(CategoriaService);
  private readonly dialog = inject(MatDialog);
  private readonly breakpointObserver = inject(BreakpointObserver);

  // Em telas pequenas, o datepicker abre em modo touch (calendário em tela cheia,
  // mais fácil de usar com o dedo) em vez do pequeno popup ancorado no input.
  readonly telaPequena$ = this.breakpointObserver.observe(Breakpoints.Handset)
    .pipe(map((resultado) => resultado.matches));

  readonly editando: boolean;
  readonly NOVA_CATEGORIA = NOVA_CATEGORIA;
  readonly NOVA_SUBCATEGORIA = NOVA_SUBCATEGORIA;

  /** Enquanto false, o orçamento selecionado é recalculado automaticamente conforme categoria/data mudam. */
  private escolhaManualOrcamento: boolean;
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
    data: [new Date(), [Validators.required]],
    orcamentoId: [null as number | null],
    recorrente: [false],
    parcelado: [false],
    diaDoMes: [new Date().getDate() as number | null],
    numeroParcelas: [null as number | null]
  });

  constructor(
    private readonly dialogRef: MatDialogRef<GastoFormDialogComponent>,
    @Inject(MAT_DIALOG_DATA) data: GastoFormDialogData
  ) {
    this.editando = !!data.gasto;
    // Editando um gasto existente: respeita o vínculo já salvo (inclusive se estiver em branco)
    // em vez de forçar uma nova sugestão automática.
    this.escolhaManualOrcamento = this.editando;
    this.categoriaAnterior = data.gasto?.categoriaId ?? null;
    this.subcategoriaAnterior = data.gasto?.subcategoriaId ?? null;

    if (data.gasto) {
      this.form.patchValue({
        descricao: data.gasto.descricao,
        valor: data.gasto.valor,
        categoriaId: data.gasto.categoriaId,
        subcategoriaId: data.gasto.subcategoriaId ?? null,
        data: this.parseDataLocal(data.gasto.data),
        orcamentoId: data.gasto.orcamentoId ?? null
      });
    } else if (data.valoresIniciais) {
      this.form.patchValue({
        descricao: data.valoresIniciais.descricao,
        valor: data.valoresIniciais.valor,
        data: this.parseDataLocal(data.valoresIniciais.data)
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

    this.form.controls.data.valueChanges.subscribe(() => this.atualizarOpcoesOrcamento());

    // "Tornar recorrente" e "Parcelar compra" são mutuamente exclusivos (ver
    // [disabled] no template, que impede marcar os dois pela UI) - cada um só precisa
    // reagir à própria mudança pra atualizar os validators dos campos que controla.
    this.form.controls.recorrente.valueChanges.subscribe((ativo) =>
      this.atualizarValidadoresDiaDoMes(!!ativo || !!this.form.controls.parcelado.value));
    this.form.controls.parcelado.valueChanges.subscribe((ativo) => {
      this.atualizarValidadoresDiaDoMes(!!ativo || !!this.form.controls.recorrente.value);
      const numeroParcelas = this.form.controls.numeroParcelas;
      numeroParcelas.setValidators(ativo ? [Validators.required, Validators.min(2), Validators.max(60)] : []);
      numeroParcelas.updateValueAndValidity();
    });
  }

  private atualizarValidadoresDiaDoMes(ativo: boolean): void {
    const diaDoMes = this.form.controls.diaDoMes;
    diaDoMes.setValidators(ativo ? [Validators.required, Validators.min(1), Validators.max(31)] : []);
    diaDoMes.updateValueAndValidity();
  }

  onCategoriaChange(evento: MatSelectChange): void {
    if (evento.value === NOVA_CATEGORIA) {
      // Volta pro valor anterior enquanto o mini-diálogo está aberto, sem disparar
      // valueChanges de novo (senão reentraria aqui).
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

  onOrcamentoSelecionadoManualmente(_evento: MatSelectChange): void {
    this.escolhaManualOrcamento = true;
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

    if (valores.recorrente) {
      const recorrente: GastoRecorrente = {
        descricao: valores.descricao!.trim(),
        valor: valores.valor!,
        categoriaId: valores.categoriaId!,
        subcategoriaId: valores.subcategoriaId ?? null,
        diaDoMes: valores.diaDoMes!,
        orcamentoId: valores.orcamentoId ?? null
      };
      this.dialogRef.close({ tipo: 'recorrente', recorrente } satisfies GastoFormResultado);
      return;
    }

    if (valores.parcelado) {
      const parcelada: CompraParcelada = {
        descricao: valores.descricao!.trim(),
        valorTotal: valores.valor!,
        numeroParcelas: valores.numeroParcelas!,
        categoriaId: valores.categoriaId!,
        subcategoriaId: valores.subcategoriaId ?? null,
        diaDoMes: valores.diaDoMes!,
        orcamentoId: valores.orcamentoId ?? null
      };
      this.dialogRef.close({ tipo: 'parcelada', parcelada } satisfies GastoFormResultado);
      return;
    }

    const gasto: Gasto = {
      descricao: valores.descricao!.trim(),
      valor: valores.valor!,
      categoriaId: valores.categoriaId!,
      subcategoriaId: valores.subcategoriaId ?? null,
      data: this.formatarDataIso(valores.data!),
      orcamentoId: valores.orcamentoId ?? null
    };
    this.dialogRef.close({ tipo: 'gasto', gasto } satisfies GastoFormResultado);
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
    const ref = this.dialog.open<SubcategoriaFormDialogComponent, SubcategoriaFormDialogData, string>(
      SubcategoriaFormDialogComponent,
      { data: { categoriaNome, subcategoria: null }, width: '420px', maxWidth: '95vw' }
    );
    ref.afterClosed().subscribe((nome) => {
      if (!nome) {
        return;
      }
      this.categoriaService.criarSubcategoria(categoriaId, { nome }).subscribe({
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
      // Orçamentos gerais (sem subcategoria) aparecem antes dos específicos da
      // mesma categoria, para ficar visualmente claro qual é o "guarda-chuva".
      .sort((a, b) =>
        (a.categoria ?? '').localeCompare(b.categoria ?? '')
        || Number(!!a.subcategoriaId) - Number(!!b.subcategoriaId)
        || (a.subcategoria ?? '').localeCompare(b.subcategoria ?? ''));

    if (this.escolhaManualOrcamento) {
      return;
    }

    const categoriaId = this.form.controls.categoriaId.value;
    if (!categoriaId) {
      this.form.controls.orcamentoId.setValue(null);
      return;
    }
    const subcategoriaId = this.form.controls.subcategoriaId.value;

    // Se o gasto já tem subcategoria escolhida, prioriza o orçamento específico
    // dela; só cai para o orçamento geral da categoria (sem subcategoria) se não
    // houver um específico correspondente.
    const especifico = subcategoriaId
      ? this.opcoesOrcamento.find((o) => o.categoriaId === categoriaId && o.subcategoriaId === subcategoriaId)
      : undefined;
    const geral = this.opcoesOrcamento.find((o) => o.categoriaId === categoriaId && !o.subcategoriaId);

    this.form.controls.orcamentoId.setValue((especifico ?? geral)?.id ?? null);
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
