import { Component, Inject, inject, OnInit } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialog, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule, MatSelectChange } from '@angular/material/select';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';

import { Orcamento } from '../../../models/orcamento.model';
import { Categoria, Subcategoria } from '../../../models/categoria.model';
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

export interface OrcamentoFormDialogData {
  mes: number;
  ano: number;
  orcamento?: Orcamento | null;
}

const NOVA_CATEGORIA = -1;
const NOVA_SUBCATEGORIA = -1;

@Component({
  selector: 'app-orcamento-form-dialog',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    MatDialogModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatButtonModule,
    MatIconModule,
    MascaraMoedaDirective
  ],
  templateUrl: './orcamento-form-dialog.component.html',
  styleUrl: './orcamento-form-dialog.component.css'
})
export class OrcamentoFormDialogComponent implements OnInit {

  private readonly fb = inject(FormBuilder);
  private readonly categoriaService = inject(CategoriaService);
  private readonly dialog = inject(MatDialog);

  readonly meses = [
    { valor: 1, nome: 'Janeiro' }, { valor: 2, nome: 'Fevereiro' }, { valor: 3, nome: 'Março' },
    { valor: 4, nome: 'Abril' }, { valor: 5, nome: 'Maio' }, { valor: 6, nome: 'Junho' },
    { valor: 7, nome: 'Julho' }, { valor: 8, nome: 'Agosto' }, { valor: 9, nome: 'Setembro' },
    { valor: 10, nome: 'Outubro' }, { valor: 11, nome: 'Novembro' }, { valor: 12, nome: 'Dezembro' }
  ];

  readonly editando: boolean;
  readonly NOVA_CATEGORIA = NOVA_CATEGORIA;
  readonly NOVA_SUBCATEGORIA = NOVA_SUBCATEGORIA;

  private categoriaAnterior: number | null;
  private subcategoriaAnterior: number | null;

  private todasCategorias: Categoria[] = [];
  private todasSubcategorias: Subcategoria[] = [];

  opcoesCategoria: Categoria[] = [];
  opcoesSubcategoria: Subcategoria[] = [];

  readonly form = this.fb.group({
    categoriaId: [null as number | null, [Validators.required]],
    subcategoriaId: [null as number | null],
    valorLimite: [null as number | null, [Validators.required, Validators.min(0.01)]],
    mes: [1, [Validators.required]],
    ano: [new Date().getFullYear(), [Validators.required, Validators.min(2000)]]
  });

  constructor(
    private readonly dialogRef: MatDialogRef<OrcamentoFormDialogComponent>,
    @Inject(MAT_DIALOG_DATA) private readonly data: OrcamentoFormDialogData
  ) {
    this.editando = !!data.orcamento;
    this.categoriaAnterior = data.orcamento?.categoriaId ?? null;
    this.subcategoriaAnterior = data.orcamento?.subcategoriaId ?? null;

    if (data.orcamento) {
      this.form.patchValue({
        categoriaId: data.orcamento.categoriaId,
        subcategoriaId: data.orcamento.subcategoriaId ?? null,
        valorLimite: data.orcamento.valorLimite,
        mes: data.orcamento.mes,
        ano: data.orcamento.ano
      });
    } else {
      this.form.patchValue({ mes: data.mes, ano: data.ano });
    }
  }

  ngOnInit(): void {
    this.categoriaService.listarVisiveis().subscribe({
      next: (categorias) => {
        this.todasCategorias = categorias;
        this.opcoesCategoria = categorias;
      },
      error: () => { /* lista auxiliar */ }
    });
    this.categoriaService.listarTodasSubcategorias().subscribe({
      next: (subcategorias) => {
        this.todasSubcategorias = subcategorias;
        this.atualizarOpcoesSubcategoria();
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
  }

  onSubcategoriaChange(evento: MatSelectChange): void {
    if (evento.value === NOVA_SUBCATEGORIA) {
      this.form.controls.subcategoriaId.setValue(this.subcategoriaAnterior, { emitEvent: false });
      this.abrirNovaSubcategoria();
      return;
    }
    this.subcategoriaAnterior = evento.value;
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
    const orcamento: Orcamento = {
      categoriaId: valores.categoriaId!,
      subcategoriaId: valores.subcategoriaId ?? null,
      valorLimite: valores.valorLimite!,
      mes: valores.mes!,
      ano: valores.ano!
    };
    this.dialogRef.close(orcamento);
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
}
