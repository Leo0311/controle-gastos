import { Component, OnInit, inject } from '@angular/core';
import { MatTabsModule } from '@angular/material/tabs';

import { CategoriaService } from '../../../services/categoria.service';
import { GastoService } from '../../../services/gasto.service';
import { Categoria, Subcategoria } from '../../../models/categoria.model';
import { AbasArrastaveisDirective } from '../../../shared/abas-arrastaveis.directive';
import {
  GrupoMesCalendario,
  agruparProximasContas,
  contarLancamentosFuturosPorRecorrente,
  hojeIso
} from '../proximas-contas';
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
 * - a leitura de gastos, que alimenta tanto o calendário da aba "Próximas contas"
 *   quanto a contagem de "lançamentos futuros já gerados" mostrada na aba
 *   "Recorrentes" - um request só, igual antes.
 *
 * Quando a aba "Recorrentes" pausa/reativa uma recorrência, ela emite
 * `recorrenciaAlternada` e o calendário é recarregado.
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
  carregandoCalendario = false;
  erroCalendario = false;

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

  carregarCalendario(): void {
    this.carregandoCalendario = true;
    this.erroCalendario = false;
    this.gastoService.listarTodos().subscribe({
      next: (gastos) => {
        const hoje = hojeIso();
        this.calendario = agruparProximasContas(gastos, hoje);
        this.lancamentosFuturosPorRecorrente = contarLancamentosFuturosPorRecorrente(gastos, hoje);
        this.carregandoCalendario = false;
      },
      error: () => {
        this.calendario = [];
        this.carregandoCalendario = false;
        this.erroCalendario = true;
      }
    });
  }
}
