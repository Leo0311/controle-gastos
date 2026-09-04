import { AsyncPipe, CurrencyPipe } from '@angular/common';
import { Component, DestroyRef, Inject, inject, OnInit } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
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
import { debounceTime, map } from 'rxjs';

import { Gasto } from '../../../models/gasto.model';
import { GastoService } from '../../../services/gasto.service';
import { calcularSugestaoCategoria, SugestaoCategoria } from './sugestao-categoria';
import { sugerirPorDicionario } from './dicionario-categorias';
import { GastoRecorrente } from '../../../models/gasto-recorrente.model';
import { CompraParcelada } from '../../../models/compra-parcelada.model';
import { Orcamento } from '../../../models/orcamento.model';
import { Categoria, Subcategoria } from '../../../models/categoria.model';
import { OrcamentoService } from '../../../services/orcamento.service';
import { CategoriaService } from '../../../services/categoria.service';
import { MascaraMoedaDirective } from '../../../shared/mascara-moeda.directive';
import { MascaraDataDirective } from '../../../shared/mascara-data.directive';
import { definirHabilitado } from '../../../shared/form-utils';
import {
  CategoriaFormDialogComponent,
  CategoriaFormDialogData
} from '../../../shared/categoria-form-dialog/categoria-form-dialog.component';
import {
  SubcategoriaFormDialogComponent,
  SubcategoriaFormDialogData,
  SubcategoriaFormResultado
} from '../../../shared/subcategoria-form-dialog/subcategoria-form-dialog.component';

export interface GastoFormDialogData {
  gasto: Gasto | null;
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
    MascaraMoedaDirective,
    MascaraDataDirective
  ],
  templateUrl: './gasto-form-dialog.component.html',
  styleUrl: './gasto-form-dialog.component.css'
})
export class GastoFormDialogComponent implements OnInit {

  private readonly fb = inject(FormBuilder);
  private readonly orcamentoService = inject(OrcamentoService);
  private readonly categoriaService = inject(CategoriaService);
  private readonly gastoService = inject(GastoService);
  private readonly dialog = inject(MatDialog);
  private readonly breakpointObserver = inject(BreakpointObserver);
  private readonly destroyRef = inject(DestroyRef);

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

  // Auto-categorização: gastos anteriores do usuário (carregados só no modo "Novo
  // gasto") e a combinação categoria+subcategoria sugerida a partir da descrição
  // digitada. `sugestaoBruta` é o que o histórico indica; o getter `sugestao`
  // esconde o chip quando o form já está exatamente naquela combinação, ou quando
  // o usuário fechou a sugestão no "x" para o texto atual.
  private gastosAnteriores: Gasto[] = [];
  private sugestaoBruta: (SugestaoCategoria & { rotulo: string }) | null = null;
  private sugestaoDispensada = false;

  readonly form = this.fb.group({
    descricao: ['', [Validators.required, Validators.maxLength(150)]],
    valor: [null as number | null, [Validators.required, Validators.min(0.01)]],
    categoriaId: [null as number | null, [Validators.required]],
    // Começa desabilitado: só faz sentido escolher subcategoria depois de ter
    // uma categoria (habilitado/desabilitado reativamente em ngOnInit).
    subcategoriaId: [{ value: null as number | null, disabled: true }],
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
    }
  }

  ngOnInit(): void {
    this.categoriaService.listarVisiveis().subscribe({
      next: (categorias) => {
        this.todasCategorias = categorias;
        this.opcoesCategoria = categorias;
        // A sugestão pelo dicionário precisa das categorias do sistema pra
        // resolver nome -> ID; recalcula caso já haja texto digitado quando a
        // lista termina de carregar.
        this.recalcularSugestaoSeNovo();
      },
      error: () => { /* lista auxiliar; sem ela o dropdown só fica vazio */ }
    });
    this.categoriaService.listarTodasSubcategorias().subscribe({
      next: (subcategorias) => {
        this.todasSubcategorias = subcategorias;
        this.atualizarOpcoesSubcategoria();
        this.recalcularSugestaoSeNovo();
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

    // Auto-categorização: só faz sentido ao criar um gasto novo. Carrega o
    // histórico uma vez e recalcula a sugestão conforme a descrição é digitada
    // (debounce para não rodar a cada tecla).
    if (!this.editando) {
      this.gastoService.listarTodos().subscribe({
        next: (gastos) => {
          this.gastosAnteriores = gastos;
          this.recalcularSugestao(this.form.controls.descricao.value ?? '');
        },
        error: () => { /* sugestão é auxiliar; sem histórico, só não sugere nada */ }
      });
      this.form.controls.descricao.valueChanges
        .pipe(debounceTime(400), takeUntilDestroyed(this.destroyRef))
        .subscribe((texto) => this.recalcularSugestao(texto ?? ''));
    }

    this.form.controls.data.valueChanges.subscribe(() => this.atualizarOpcoesOrcamento());

    // Subcategoria só fica habilitada quando há uma categoria escolhida - reage
    // tanto à seleção manual quanto a setValue programático (edição, "+ Nova
    // categoria"). O sync inicial cobre o modo edição, em que a categoria já vem
    // preenchida pelo construtor (antes deste subscribe existir).
    this.form.controls.categoriaId.valueChanges.subscribe((categoriaId) =>
      this.sincronizarHabilitacaoSubcategoria(categoriaId));
    this.sincronizarHabilitacaoSubcategoria(this.form.controls.categoriaId.value);

    // "Tornar recorrente" e "Parcelar compra" são mutuamente exclusivos: marcar
    // um desabilita o outro (emitEvent: false para não reentrar no subscribe
    // oposto). Cada um também atualiza os validators dos campos que controla.
    this.form.controls.recorrente.valueChanges.subscribe((ativo) => {
      definirHabilitado(this.form.controls.parcelado, !ativo);
      this.atualizarValidadoresDiaDoMes(!!ativo || !!this.form.controls.parcelado.value);
    });
    this.form.controls.parcelado.valueChanges.subscribe((ativo) => {
      definirHabilitado(this.form.controls.recorrente, !ativo);
      this.atualizarValidadoresDiaDoMes(!!ativo || !!this.form.controls.recorrente.value);
      const numeroParcelas = this.form.controls.numeroParcelas;
      numeroParcelas.setValidators(ativo ? [Validators.required, Validators.min(2), Validators.max(120)] : []);
      numeroParcelas.updateValueAndValidity();
    });
  }

  private sincronizarHabilitacaoSubcategoria(categoriaId: number | null): void {
    const temCategoriaValida = !!categoriaId && categoriaId !== NOVA_CATEGORIA;
    definirHabilitado(this.form.controls.subcategoriaId, temCategoriaValida);
  }

  private atualizarValidadoresDiaDoMes(ativo: boolean): void {
    const diaDoMes = this.form.controls.diaDoMes;
    diaDoMes.setValidators(ativo ? [Validators.required, Validators.min(1), Validators.max(31)] : []);
    diaDoMes.updateValueAndValidity();
  }

  onCategoriaChange(evento: MatSelectChange): void {
    if (evento.value === NOVA_CATEGORIA) {
      // Volta pro valor anterior enquanto o mini-diálogo está aberto, sem disparar
      // valueChanges de novo (senão reentraria aqui) - e re-sincroniza o estado da
      // subcategoria, que o valueChanges com o sentinela -1 acabou de desabilitar.
      this.form.controls.categoriaId.setValue(this.categoriaAnterior, { emitEvent: false });
      this.sincronizarHabilitacaoSubcategoria(this.categoriaAnterior);
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

  /** Chip de sugestão a exibir agora — ou null quando não há o que sugerir. */
  get sugestao(): (SugestaoCategoria & { rotulo: string }) | null {
    if (!this.sugestaoBruta || this.sugestaoDispensada) {
      return null;
    }
    const categoriaAtual = this.form.controls.categoriaId.value;
    const subcategoriaAtual = this.form.controls.subcategoriaId.value ?? null;
    if (categoriaAtual === this.sugestaoBruta.categoriaId && subcategoriaAtual === this.sugestaoBruta.subcategoriaId) {
      return null;
    }
    return this.sugestaoBruta;
  }

  // Prioridade: o histórico pessoal do usuário sempre ganha; o dicionário de
  // palavras-chave (ver dicionario-categorias.ts) só entra como plano B, quando
  // o histórico não indica nada - assim termos que o usuário nunca cadastrou
  // ("café da manhã", "farmácia") ainda geram sugestão, mas sem sobrepor o que
  // ele já classificou do próprio jeito.
  private recalcularSugestaoSeNovo(): void {
    if (!this.editando) {
      this.recalcularSugestao(this.form.controls.descricao.value ?? '');
    }
  }

  private recalcularSugestao(texto: string): void {
    this.sugestaoDispensada = false;
    const combo = calcularSugestaoCategoria(texto, this.gastosAnteriores)
      ?? sugerirPorDicionario(texto, this.todasCategorias, this.todasSubcategorias);
    this.sugestaoBruta = combo ? { ...combo, rotulo: this.montarRotuloSugestao(combo) } : null;
  }

  private montarRotuloSugestao(combo: SugestaoCategoria): string {
    const categoria = this.todasCategorias.find((c) => c.id === combo.categoriaId);
    const rotuloCategoria = categoria ? `${categoria.emoji} ${categoria.nome}` : 'Categoria';
    if (!combo.subcategoriaId) {
      return rotuloCategoria;
    }
    const subcategoria = this.todasSubcategorias.find((s) => s.id === combo.subcategoriaId);
    return subcategoria ? `${rotuloCategoria} > ${subcategoria.emoji} ${subcategoria.nome}` : rotuloCategoria;
  }

  aplicarSugestao(): void {
    const sugestao = this.sugestao;
    if (!sugestao) {
      return;
    }
    this.form.controls.categoriaId.setValue(sugestao.categoriaId);
    this.categoriaAnterior = sugestao.categoriaId;
    this.atualizarOpcoesSubcategoria();
    this.form.controls.subcategoriaId.setValue(sugestao.subcategoriaId);
    this.subcategoriaAnterior = sugestao.subcategoriaId;
    this.atualizarOpcoesOrcamento();
    // Não zera `sugestaoBruta`: o getter `sugestao` já esconde o chip enquanto a
    // combinação selecionada for a sugerida, e volta a mostrá-lo se o usuário
    // trocar a categoria/subcategoria manualmente depois.
  }

  dispensarSugestao(): void {
    this.sugestaoDispensada = true;
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
