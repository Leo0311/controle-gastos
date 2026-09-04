import { Component, OnInit, inject } from '@angular/core';
import { CurrencyPipe } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatChipsModule } from '@angular/material/chips';
import { MatMenuModule } from '@angular/material/menu';
import { MatTabsModule } from '@angular/material/tabs';
import { MatExpansionModule } from '@angular/material/expansion';
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
import { ErroCarregamentoComponent } from '../../../shared/erro-carregamento/erro-carregamento.component';
import { AbasArrastaveisDirective } from '../../../shared/abas-arrastaveis.directive';

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
    MatExpansionModule,
    MatDialogModule,
    MatSnackBarModule,
    MatProgressSpinnerModule,
    EmptyStateComponent,
    ErroCarregamentoComponent,
    AbasArrastaveisDirective
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
  // Uma flag de erro por aba - cada aba carrega separado e mostra seu próprio
  // estado de erro inline, sem um snackbar sobrescrevendo o aviso do outro.
  erro = false;
  erroParceladas = false;
  erroCalendario = false;

  private categoriasPorId = new Map<number, Categoria>();
  private subcategoriasPorId = new Map<number, Subcategoria>();

  // Quantos gastos futuros (data >= hoje) já foram pré-gerados por cada recorrência.
  // Vem da MESMA leitura de gastos que a aba "Próximas contas" já faz em
  // carregarCalendario() - nenhum request a mais. Usado no card das recorrências
  // pausadas (o "Pausado" sozinho não diz que os lançamentos já gerados continuam)
  // e no diálogo de confirmação ao pausar.
  private lancamentosFuturosPorRecorrente = new Map<number, number>();

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
    this.erroCalendario = false;
    this.gastoService.listarTodos().subscribe({
      next: (gastos) => {
        this.calendario = this.agruparProximasContas(gastos);
        this.recalcularLancamentosFuturos(gastos);
        this.carregandoCalendario = false;
      },
      error: () => {
        this.calendario = [];
        this.carregandoCalendario = false;
        this.erroCalendario = true;
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

  // Conta, por recorrência, os gastos com data >= hoje já vinculados a ela (os
  // pré-gerados pelo horizonte "gerar próximos meses"). Reusa a lista que
  // carregarCalendario já baixou - sem request novo.
  private recalcularLancamentosFuturos(gastos: Gasto[]): void {
    const hoje = this.hojeIso();
    const mapa = new Map<number, number>();
    for (const gasto of gastos) {
      if (gasto.gastoRecorrenteId != null && gasto.data >= hoje) {
        mapa.set(gasto.gastoRecorrenteId, (mapa.get(gasto.gastoRecorrenteId) ?? 0) + 1);
      }
    }
    this.lancamentosFuturosPorRecorrente = mapa;
  }

  lancamentosFuturos(recorrenteId: number | undefined): number {
    return recorrenteId != null ? (this.lancamentosFuturosPorRecorrente.get(recorrenteId) ?? 0) : 0;
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
    this.erro = false;
    this.service.listarTodos().subscribe({
      next: (recorrentes) => {
        this.recorrentes = recorrentes;
        this.carregando = false;
      },
      error: () => {
        this.recorrentes = [];
        this.carregando = false;
        this.erro = true;
      }
    });
  }

  carregarParceladas(): void {
    this.carregandoParceladas = true;
    this.erroParceladas = false;
    this.parceladaService.listarTodos().subscribe({
      next: (parceladas) => {
        this.parceladas = parceladas;
        this.carregandoParceladas = false;
      },
      error: () => {
        this.parceladas = [];
        this.carregandoParceladas = false;
        this.erroParceladas = true;
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
    // Reativar é inócuo (volta a gerar daqui pra frente); pausar tem uma
    // consequência que o chip sozinho não comunica, então confirma antes.
    if (recorrente.ativo) {
      this.confirmarPausa(recorrente);
    } else {
      this.executarAlternarAtivo(recorrente);
    }
  }

  private confirmarPausa(recorrente: GastoRecorrente): void {
    const futuros = this.lancamentosFuturos(recorrente.id);
    const consequencia = futuros === 0
      ? 'Nenhum lançamento futuro foi pré-gerado ainda, então nada muda nas outras telas. Para encerrar de '
        + 'vez, use Excluir (que mantém o histórico dos meses passados).'
      : (futuros === 1
          ? 'Há 1 lançamento futuro já gerado (de hoje em diante) que continua'
          : `Há ${futuros} lançamentos futuros já gerados (de hoje em diante) que continuam`)
        + ' na lista de Gastos, no Dashboard e em "Próximas contas" - pausar não remove '
        + (futuros === 1 ? 'esse lançamento' : 'nenhum deles')
        + '. Para remover também os lançamentos futuros, use Excluir, que apaga os lançamentos a partir de hoje '
        + 'e mantém o histórico dos meses passados.';
    const ref = this.dialog.open<ConfirmDialogComponent, ConfirmDialogData, boolean>(ConfirmDialogComponent, {
      data: {
        titulo: 'Pausar recorrência',
        mensagem: `Pausar "${recorrente.descricao}" só impede a geração de NOVOS lançamentos daqui pra frente. `
          + consequencia
      }
    });
    ref.afterClosed().subscribe((confirmado) => {
      if (confirmado) {
        this.executarAlternarAtivo(recorrente);
      }
    });
  }

  private executarAlternarAtivo(recorrente: GastoRecorrente): void {
    this.service.alternarAtivo(recorrente.id!).subscribe({
      next: (atualizado) => {
        this.mostrarSucesso(atualizado.ativo ? 'Recorrência reativada.' : 'Recorrência pausada.');
        this.carregar();
        // reativar pode lançar o gasto do mês corrente; recarrega o contador e a
        // aba "Próximas contas" pra refletir na hora.
        this.carregarCalendario();
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
