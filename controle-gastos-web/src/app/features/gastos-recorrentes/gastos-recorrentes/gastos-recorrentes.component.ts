import { Component, OnInit, inject } from '@angular/core';
import { CurrencyPipe } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatChipsModule } from '@angular/material/chips';
import { MatMenuModule } from '@angular/material/menu';
import { MatTabsModule } from '@angular/material/tabs';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';

import { GastoRecorrenteService } from '../../../services/gasto-recorrente.service';
import { CompraParceladaService } from '../../../services/compra-parcelada.service';
import { CategoriaService } from '../../../services/categoria.service';
import { GastoService } from '../../../services/gasto.service';
import { GastoRecorrente } from '../../../models/gasto-recorrente.model';
import { CompraParcelada } from '../../../models/compra-parcelada.model';
import { Gasto } from '../../../models/gasto.model';
import { Categoria, Subcategoria } from '../../../models/categoria.model';
import {
  GastoRecorrenteFormDialogComponent,
  GastoRecorrenteFormDialogData
} from '../gasto-recorrente-form-dialog/gasto-recorrente-form-dialog.component';
import { ConfirmDialogComponent, ConfirmDialogData } from '../../../shared/confirm-dialog/confirm-dialog.component';
import { EmptyStateComponent } from '../../../shared/empty-state/empty-state.component';

const NOMES_MESES = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
];

/** Um lançamento futuro (recorrente ou parcela) na aba "Próximas contas". */
interface ItemCalendario {
  data: string;
  descricao: string;
  valor: number;
  origem: 'recorrente' | 'parcela';
}

/** Grupo de um mês na aba "Próximas contas", com o total do mês. */
interface GrupoMesCalendario {
  chave: string;
  rotulo: string;
  total: number;
  itens: ItemCalendario[];
}

@Component({
  selector: 'app-gastos-recorrentes',
  standalone: true,
  imports: [
    CurrencyPipe,
    MatButtonModule,
    MatIconModule,
    MatChipsModule,
    MatMenuModule,
    MatTabsModule,
    MatDialogModule,
    MatSnackBarModule,
    MatProgressSpinnerModule,
    EmptyStateComponent
  ],
  templateUrl: './gastos-recorrentes.component.html',
  styleUrl: './gastos-recorrentes.component.css'
})
export class GastosRecorrentesComponent implements OnInit {

  private readonly service = inject(GastoRecorrenteService);
  private readonly parceladaService = inject(CompraParceladaService);
  private readonly categoriaService = inject(CategoriaService);
  private readonly gastoService = inject(GastoService);
  private readonly dialog = inject(MatDialog);
  private readonly snackBar = inject(MatSnackBar);

  recorrentes: GastoRecorrente[] = [];
  parceladas: CompraParcelada[] = [];
  calendario: GrupoMesCalendario[] = [];
  carregando = false;
  carregandoParceladas = false;
  carregandoCalendario = false;

  private categoriasPorId = new Map<number, Categoria>();
  private subcategoriasPorId = new Map<number, Subcategoria>();

  ngOnInit(): void {
    this.categoriaService.listarVisiveis().subscribe({
      next: (categorias) => { this.categoriasPorId = new Map(categorias.map((c) => [c.id!, c])); },
      error: () => { /* usado só pro emoji/nome na listagem */ }
    });
    this.categoriaService.listarTodasSubcategorias().subscribe({
      next: (subcategorias) => { this.subcategoriasPorId = new Map(subcategorias.map((s) => [s.id!, s])); },
      error: () => { /* usado só pro nome na listagem */ }
    });
    this.carregar();
    this.carregarParceladas();
    this.carregarCalendario();
  }

  carregarCalendario(): void {
    this.carregandoCalendario = true;
    this.gastoService.listarTodos().subscribe({
      next: (gastos) => {
        this.calendario = this.agruparProximasContas(gastos);
        this.carregandoCalendario = false;
      },
      error: () => {
        this.carregandoCalendario = false;
        this.mostrarErro('Não foi possível carregar as próximas contas. Verifique se a API está no ar.');
      }
    });
  }

  // Gastos futuros (data >= hoje) que vieram de uma recorrência ou de uma compra
  // parcelada, agrupados por mês em ordem cronológica, com o total de cada mês.
  private agruparProximasContas(gastos: Gasto[]): GrupoMesCalendario[] {
    const hoje = this.hojeIso();
    const futuros = gastos
      .filter((g) => g.data >= hoje && (g.gastoRecorrenteId != null || g.compraParceladaId != null))
      .sort((a, b) => a.data.localeCompare(b.data));

    const grupos = new Map<string, GrupoMesCalendario>();
    for (const gasto of futuros) {
      const chave = gasto.data.slice(0, 7);
      let grupo = grupos.get(chave);
      if (!grupo) {
        grupo = { chave, rotulo: this.rotuloMes(chave), total: 0, itens: [] };
        grupos.set(chave, grupo);
      }
      grupo.total += gasto.valor;
      grupo.itens.push({
        data: gasto.data,
        descricao: gasto.descricao,
        valor: gasto.valor,
        origem: gasto.compraParceladaId != null ? 'parcela' : 'recorrente'
      });
    }
    return [...grupos.values()];
  }

  private hojeIso(): string {
    const hoje = new Date();
    const ano = hoje.getFullYear();
    const mes = String(hoje.getMonth() + 1).padStart(2, '0');
    const dia = String(hoje.getDate()).padStart(2, '0');
    return `${ano}-${mes}-${dia}`;
  }

  private rotuloMes(chave: string): string {
    const [ano, mes] = chave.split('-').map(Number);
    return `${NOMES_MESES[mes - 1]} de ${ano}`;
  }

  formatarDiaMes(data: string): string {
    const [, mes, dia] = data.split('-');
    return `${dia}/${mes}`;
  }

  carregar(): void {
    this.carregando = true;
    this.service.listarTodos().subscribe({
      next: (recorrentes) => {
        this.recorrentes = recorrentes;
        this.carregando = false;
      },
      error: () => {
        this.carregando = false;
        this.mostrarErro('Não foi possível carregar os gastos recorrentes. Verifique se a API está no ar.');
      }
    });
  }

  carregarParceladas(): void {
    this.carregandoParceladas = true;
    this.parceladaService.listarTodos().subscribe({
      next: (parceladas) => {
        this.parceladas = parceladas;
        this.carregandoParceladas = false;
      },
      error: () => {
        this.carregandoParceladas = false;
        this.mostrarErro('Não foi possível carregar as compras parceladas. Verifique se a API está no ar.');
      }
    });
  }

  excluirParcelada(parcelada: CompraParcelada): void {
    const ref = this.dialog.open<ConfirmDialogComponent, ConfirmDialogData, boolean>(ConfirmDialogComponent, {
      data: {
        titulo: 'Excluir compra parcelada',
        mensagem: `Tem certeza que deseja excluir "${parcelada.descricao}"? A compra é removida por completo (ação `
          + 'definitiva, sem reativar) - as parcelas já vencidas (data igual ou anterior a hoje) continuam na '
          + 'listagem de Gastos como histórico, só as parcelas futuras são removidas.'
      }
    });
    ref.afterClosed().subscribe((confirmado) => {
      if (!confirmado) {
        return;
      }
      this.parceladaService.excluir(parcelada.id!).subscribe({
        next: () => {
          this.mostrarSucesso('Compra parcelada excluída com sucesso!');
          this.carregarParceladas();
        },
        error: (erro) => this.mostrarErro(this.mensagemErro(erro))
      });
    });
  }

  categoriaLabel(categoriaId: number): string {
    const categoria = this.categoriasPorId.get(categoriaId);
    return categoria ? `${categoria.emoji} ${categoria.nome}` : '';
  }

  subcategoriaLabel(subcategoriaId: number | null | undefined): string {
    return subcategoriaId ? (this.subcategoriasPorId.get(subcategoriaId)?.nome ?? '') : '';
  }

  novoRecorrente(): void {
    const ref = this.dialog.open<GastoRecorrenteFormDialogComponent, GastoRecorrenteFormDialogData, GastoRecorrente>(
      GastoRecorrenteFormDialogComponent,
      { data: { recorrente: null }, width: '480px', maxWidth: '95vw' }
    );
    ref.afterClosed().subscribe((resultado) => {
      if (!resultado) {
        return;
      }
      this.service.cadastrar(resultado).subscribe({
        next: () => {
          this.mostrarSucesso('Gasto recorrente cadastrado com sucesso!');
          this.carregar();
        },
        error: (erro) => this.mostrarErro(this.mensagemErro(erro))
      });
    });
  }

  editar(recorrente: GastoRecorrente): void {
    const ref = this.dialog.open<GastoRecorrenteFormDialogComponent, GastoRecorrenteFormDialogData, GastoRecorrente>(
      GastoRecorrenteFormDialogComponent,
      { data: { recorrente }, width: '480px', maxWidth: '95vw' }
    );
    ref.afterClosed().subscribe((resultado) => {
      if (!resultado) {
        return;
      }
      this.service.atualizar(recorrente.id!, resultado).subscribe({
        next: () => {
          this.mostrarSucesso('Gasto recorrente atualizado com sucesso!');
          this.carregar();
        },
        error: (erro) => this.mostrarErro(this.mensagemErro(erro))
      });
    });
  }

  alternarAtivo(recorrente: GastoRecorrente): void {
    this.service.alternarAtivo(recorrente.id!).subscribe({
      next: (atualizado) => {
        this.mostrarSucesso(atualizado.ativo ? 'Recorrência reativada.' : 'Recorrência pausada.');
        this.carregar();
      },
      error: (erro) => this.mostrarErro(this.mensagemErro(erro))
    });
  }

  excluir(recorrente: GastoRecorrente): void {
    const ref = this.dialog.open<ConfirmDialogComponent, ConfirmDialogData, boolean>(ConfirmDialogComponent, {
      data: {
        titulo: 'Excluir gasto recorrente',
        mensagem: `Tem certeza que deseja excluir a recorrência "${recorrente.descricao}"? `
          + 'Os gastos de meses passados continuam intactos como histórico, mas os gastos a partir de hoje '
          + '(incluindo os já pré-gerados de meses futuros que ainda não venceram) serão removidos.'
      }
    });
    ref.afterClosed().subscribe((confirmado) => {
      if (!confirmado) {
        return;
      }
      this.service.excluir(recorrente.id!).subscribe({
        next: () => {
          this.mostrarSucesso('Gasto recorrente excluído com sucesso!');
          this.carregar();
        },
        error: (erro) => this.mostrarErro(this.mensagemErro(erro))
      });
    });
  }

  private mensagemErro(erro: unknown): string {
    const erroHttp = erro as { error?: { erro?: string } };
    return erroHttp?.error?.erro ?? 'Ocorreu um erro inesperado.';
  }

  private mostrarSucesso(mensagem: string): void {
    this.snackBar.open(mensagem, 'Fechar', { duration: 3000 });
  }

  private mostrarErro(mensagem: string): void {
    this.snackBar.open(mensagem, 'Fechar', { duration: 5000 });
  }
}
