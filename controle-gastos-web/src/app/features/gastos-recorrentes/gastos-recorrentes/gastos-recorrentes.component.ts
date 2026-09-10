import { Component, OnInit, inject } from '@angular/core';
import { MatTabsModule } from '@angular/material/tabs';
import { forkJoin } from 'rxjs';

import { CategoriaService } from '../../../services/categoria.service';
import { GastoService } from '../../../services/gasto.service';
import { Categoria, Subcategoria } from '../../../models/categoria.model';
import { AbasArrastaveisDirective } from '../../../shared/abas-arrastaveis.directive';
import { GrupoMesCalendario, agruparProximasContas, hojeIso } from '../proximas-contas';
import { StatusPorFonte } from '../../../models/gasto.model';
import { ResumoStatusConta } from '../../../core/status-conta';
import { RecorrentesListaComponent } from '../recorrentes-lista/recorrentes-lista.component';
import { ParceladasListaComponent } from '../parceladas-lista/parceladas-lista.component';
import { ProximasContasComponent } from '../proximas-contas/proximas-contas.component';

/**
 * Casca das 3 abas de Recorrentes/Parceladas/Próximas contas (achado M8: um
 * componente de 424 linhas com as 3 sub-telas virou 3 componentes + lógica pura
 * em proximas-contas.ts / mensagem-pausa.ts). Aqui fica só o que cruza abas:
 *
 * - os mapas de categoria/subcategoria (usados pelos rótulos das abas Recorrentes
 *   e Parceladas), carregados uma vez;
 * - a AGENDA da aba "Próximas contas" (GET /api/gastos/proximas-contas?meses=N,
 *   janela escolhida no seletor da própria aba) e os CONTADORES agregados
 *   (GET /api/gastos/status-por-fonte) que alimentam os badges das abas
 *   Recorrentes/Parceladas e o "N lançamentos futuros". Antes tudo isso era
 *   derivado no cliente de um GET /api/gastos com o histórico inteiro.
 *
 * Quando a aba "Recorrentes" pausa/reativa uma recorrência, ela emite
 * `recorrenciaAlternada` e agenda + contadores são recarregados.
 */
@Component({
  selector: 'app-gastos-recorrentes',
  standalone: true,
  imports: [
    MatTabsModule,
    AbasArrastaveisDirective,
    RecorrentesListaComponent,
    ParceladasListaComponent,
    ProximasContasComponent
  ],
  templateUrl: './gastos-recorrentes.component.html',
  styleUrl: './gastos-recorrentes.component.css'
})
export class GastosRecorrentesComponent implements OnInit {

  private readonly categoriaService = inject(CategoriaService);
  private readonly gastoService = inject(GastoService);

  categoriasPorId = new Map<number, Categoria>();
  subcategoriasPorId = new Map<number, Subcategoria>();

  calendario: GrupoMesCalendario[] = [];
  lancamentosFuturosPorRecorrente = new Map<number, number>();
  statusPorRecorrente = new Map<number, ResumoStatusConta>();
  statusPorParcelada = new Map<number, ResumoStatusConta>();
  carregandoCalendario = false;
  erroCalendario = false;

  // Janela de meses da agenda (seletor da aba "Próximas contas"), contando o mês
  // corrente como o primeiro. 1 = só o mês corrente (+ atrasadas), o padrão ao abrir.
  mesesAgenda = 1;

  ngOnInit(): void {
    this.categoriaService.listarVisiveis().subscribe({
      next: (categorias) => { this.categoriasPorId = new Map(categorias.map((c) => [c.id!, c])); },
      error: () => { /* usado só pro emoji/nome na listagem */ }
    });
    this.categoriaService.listarTodasSubcategorias().subscribe({
      next: (subcategorias) => { this.subcategoriasPorId = new Map(subcategorias.map((s) => [s.id!, s])); },
      error: () => { /* usado só pro nome na listagem */ }
    });
    this.carregarCalendario();
  }

  // Carga completa: agenda (na janela atual) + contadores. Usada na 1ª carga, no
  // "tentar novamente", e depois de pagar/pausar/excluir - qualquer coisa que
  // possa mexer nos dois de uma vez.
  carregarCalendario(): void {
    this.carregandoCalendario = true;
    this.erroCalendario = false;
    forkJoin({
      agenda: this.gastoService.proximasContas(this.mesesAgenda),
      contadores: this.gastoService.statusPorFonte()
    }).subscribe({
      next: ({ agenda, contadores }) => {
        this.calendario = agruparProximasContas(agenda, hojeIso());
        this.aplicarContadores(contadores);
        this.carregandoCalendario = false;
      },
      error: () => {
        this.calendario = [];
        this.carregandoCalendario = false;
        this.erroCalendario = true;
      }
    });
  }

  // Troca da janela de meses no seletor: só a agenda é rebuscada (os contadores
  // são do horizonte inteiro, não mudam com o seletor). O spinner fica na lista da
  // aba, não na tela toda (carregandoCalendario é passado como [carregando]).
  onMesesAlterados(meses: number): void {
    this.mesesAgenda = meses;
    this.carregandoCalendario = true;
    this.erroCalendario = false;
    this.gastoService.proximasContas(meses).subscribe({
      next: (agenda) => {
        this.calendario = agruparProximasContas(agenda, hojeIso());
        this.carregandoCalendario = false;
      },
      error: () => {
        this.calendario = [];
        this.carregandoCalendario = false;
        this.erroCalendario = true;
      }
    });
  }

  private aplicarContadores(contadores: StatusPorFonte[]): void {
    const recorrentes = new Map<number, ResumoStatusConta>();
    const parceladas = new Map<number, ResumoStatusConta>();
    const futuros = new Map<number, number>();
    for (const c of contadores) {
      const resumo: ResumoStatusConta = { pendentes: c.pendentes, atrasadas: c.atrasadas };
      if (c.tipo === 'RECORRENTE') {
        recorrentes.set(c.id, resumo);
        futuros.set(c.id, c.futuros);
      } else {
        parceladas.set(c.id, resumo);
      }
    }
    this.statusPorRecorrente = recorrentes;
    this.statusPorParcelada = parceladas;
    this.lancamentosFuturosPorRecorrente = futuros;
  }
}
