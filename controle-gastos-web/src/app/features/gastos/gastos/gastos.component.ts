import { Component, ElementRef, OnInit, ViewChild } from '@angular/core';
import { CurrencyPipe, DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { MatTableModule } from '@angular/material/table';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { MatMenuModule } from '@angular/material/menu';
import { MatExpansionModule } from '@angular/material/expansion';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { GastoService } from '../../../services/gasto.service';
import { OrcamentoService } from '../../../services/orcamento.service';
import { CategoriaService } from '../../../services/categoria.service';
import { GastoRecorrenteService } from '../../../services/gasto-recorrente.service';
import { CompraParceladaService } from '../../../services/compra-parcelada.service';
import { Gasto } from '../../../models/gasto.model';
import { Orcamento } from '../../../models/orcamento.model';
import { Categoria } from '../../../models/categoria.model';
import {
  GastoFormDialogComponent,
  GastoFormDialogData,
  GastoFormResultado
} from '../gasto-form-dialog/gasto-form-dialog.component';
import { ConfirmDialogComponent, ConfirmDialogData } from '../../../shared/confirm-dialog/confirm-dialog.component';
import { EmptyStateComponent } from '../../../shared/empty-state/empty-state.component';
import { ErroCarregamentoComponent } from '../../../shared/erro-carregamento/erro-carregamento.component';
import { baixarModeloImportacaoGastos, exportarGastosXlsx } from '../../../core/xlsx-exporter';
import { ImportacaoGastosOrquestrador } from '../importacao/importacao-gastos.orquestrador';
import { NotificacaoService } from '../../../core/notificacao.service';
import { MESES_NOMES, MESES_OPCOES } from '../../../core/meses';
import { emojiDaCategoria } from '../../../core/categoria-emoji';

@Component({
  selector: 'app-gastos',
  standalone: true,
  imports: [
    CurrencyPipe,
    DatePipe,
    FormsModule,
    MatTableModule,
    MatButtonModule,
    MatIconModule,
    MatDialogModule,
    MatFormFieldModule,
    MatSelectModule,
    MatMenuModule,
    MatExpansionModule,
    MatSnackBarModule,
    MatProgressSpinnerModule,
    EmptyStateComponent,
    ErroCarregamentoComponent
  ],
  templateUrl: './gastos.component.html',
  styleUrl: './gastos.component.css'
})
export class GastosComponent implements OnInit {

  @ViewChild('inputArquivo') inputArquivo!: ElementRef<HTMLInputElement>;

  readonly colunas = ['descricao', 'valor', 'categoria', 'data', 'acoes'];
  gastos: Gasto[] = [];
  carregando = false;
  // Falha ao carregar: mostra o estado de erro no lugar da tabela/empty-state,
  // pra não parecer "sem gastos" quando na verdade a API caiu (ver carregar()).
  erro = false;

  // Paginação da listagem (achado C1 da auditoria): a tela carrega uma página por
  // vez via GET /api/gastos/pagina e o botão "Carregar mais" anexa a seguinte.
  private readonly tamanhoPagina = 50;
  private paginaAtual = 0;
  temMais = false;
  carregandoMais = false;

  readonly meses = MESES_OPCOES;
  readonly anos: number[];

  filtroMes: number | null = null;
  filtroAno: number | null = null;
  // ID da categoria filtrada (o filtro é aplicado no servidor, ver carregar()) -
  // null = "Todas".
  filtroCategoriaId: number | null = null;

  // Painel de filtros no mobile (ver template/CSS) - fechado por padrão, pra não
  // ocupar a tela toda antes do primeiro gasto aparecer. Abre sozinho quando o
  // período/categoria filtrado não tem nenhum gasto (ver carregar()), que é
  // justamente quando o usuário precisa mexer nele. No desktop não tem efeito -
  // os filtros continuam sempre visíveis lá (CSS só reage a isso abaixo de 600px).
  filtrosAbertos = false;

  // Refletem sempre filtroMes/filtroAno pra exibição nos <mat-select> - quando o
  // filtro de período está limpo ("ver todos os meses"), continuam mostrando o
  // mês/ano atual, pronto pra caso o usuário volte a filtrar por período.
  mesSelecionado = new Date().getMonth() + 1;
  anoSelecionado = new Date().getFullYear();

  // true só na primeiríssima leitura dos query params (ver ngOnInit) - depois disso,
  // a ausência de mes/ano na URL significa "usuário limpou o filtro de propósito"
  // (verTodosOsMeses), não "aplique o padrão do mês atual" de novo.
  private primeiraCarga = true;

  // Opções do <mat-select> de filtro por categoria - carregadas de
  // GET /api/categorias/com-gastos (categorias com pelo menos um gasto, qualquer
  // período). Recarregado a cada carregar().
  opcoesCategoriaFiltro: Categoria[] = [];

  // Emoji da categoria na tabela/cartão - populado no ngOnInit e reatualizado
  // depois de uma importação (que pode criar categorias novas).
  private categoriasPorId = new Map<number, Categoria>();
  // Só pro rótulo "Orçamento: ..." nos detalhes do cartão (mobile) - o Gasto traz
  // orcamentoId, mas não o nome do orçamento vinculado.
  private orcamentosPorId = new Map<number, Orcamento>();

  constructor(
    private readonly gastoService: GastoService,
    private readonly orcamentoService: OrcamentoService,
    private readonly categoriaService: CategoriaService,
    private readonly gastoRecorrenteService: GastoRecorrenteService,
    private readonly compraParceladaService: CompraParceladaService,
    private readonly dialog: MatDialog,
    private readonly snackBar: MatSnackBar,
    private readonly notificacao: NotificacaoService,
    private readonly orquestradorImportacao: ImportacaoGastosOrquestrador,
    private readonly route: ActivatedRoute,
    private readonly router: Router
  ) {
    const anoAtual = new Date().getFullYear();
    this.anos = Array.from({ length: 6 }, (_, i) => anoAtual - 2 + i);
  }

  ngOnInit(): void {
    this.categoriaService.listarVisiveis().subscribe({
      next: (categorias) => { this.categoriasPorId = new Map(categorias.map((c) => [c.id!, c])); },
      error: () => { /* usado só pro emoji na tabela; sem ela ainda funciona sem emoji */ }
    });
    this.orcamentoService.listarTodos().subscribe({
      next: (orcamentos) => { this.orcamentosPorId = new Map(orcamentos.map((o) => [o.id!, o])); },
      error: () => { /* rótulo do orçamento vinculado nos detalhes do cartão é auxiliar */ }
    });

    this.route.queryParamMap.subscribe((params) => {
      const mes = Number(params.get('mes'));
      const ano = Number(params.get('ano'));
      const mesValido = Number.isInteger(mes) && mes >= 1 && mes <= 12 ? mes : null;
      const anoValido = Number.isInteger(ano) && ano > 0 ? ano : null;

      if (this.primeiraCarga && mesValido === null && anoValido === null) {
        // Acesso direto à tela (sem vir de um clique no Dashboard) - começa já
        // filtrado no mês atual, em vez de mostrar todo o histórico de uma vez.
        this.filtroMes = new Date().getMonth() + 1;
        this.filtroAno = new Date().getFullYear();
      } else {
        this.filtroMes = mesValido;
        this.filtroAno = anoValido;
      }
      this.primeiraCarga = false;

      this.mesSelecionado = this.filtroMes ?? new Date().getMonth() + 1;
      this.anoSelecionado = this.filtroAno ?? new Date().getFullYear();
      const categoriaIdParam = Number(params.get('categoriaId'));
      this.filtroCategoriaId = Number.isInteger(categoriaIdParam) && categoriaIdParam > 0 ? categoriaIdParam : null;
      this.carregar();
    });

    // Verifica e lança gastos recorrentes pendentes do mês, de forma transparente
    // (sem aviso algum) - só recarrega a lista se algo novo foi lançado.
    this.gastoRecorrenteService.lancarPendentes().subscribe({
      next: (lancados) => {
        if (lancados.length > 0) {
          this.carregar();
        }
      },
      error: () => { /* verificação transparente; falha aqui não deve incomodar o usuário */ }
    });
  }

  categoriaEmoji(categoriaId: number | null | undefined): string {
    return emojiDaCategoria(this.categoriasPorId, categoriaId);
  }

  // Rótulo do orçamento vinculado a um gasto (ex: "Alimentação / Mercado"),
  // exibido só nos detalhes expandidos do cartão no mobile. String vazia = sem
  // vínculo (ou orçamentos ainda não carregados) -> a linha nem aparece.
  nomeOrcamento(orcamentoId: number | null | undefined): string {
    if (!orcamentoId) {
      return '';
    }
    const orcamento = this.orcamentosPorId.get(orcamentoId);
    if (!orcamento) {
      return '';
    }
    const nome = orcamento.categoria ?? '';
    return orcamento.subcategoria ? `${nome} / ${orcamento.subcategoria}` : nome;
  }

  // Nome da categoria filtrada (para rótulos/mensagens) - o filtro guarda só o ID.
  // Busca em opcoesCategoriaFiltro e cai em categoriasPorId (ambas podem ainda não
  // ter chegado no primeiro carregamento).
  get nomeCategoriaFiltro(): string | null {
    if (this.filtroCategoriaId === null) {
      return null;
    }
    const categoria = this.opcoesCategoriaFiltro.find((c) => c.id === this.filtroCategoriaId)
      ?? this.categoriasPorId.get(this.filtroCategoriaId);
    return categoria?.nome ?? null;
  }

  // Rótulo do botão de filtros no mobile (painel fechado) - precisa deixar claro
  // o que está sendo mostrado sem o usuário ter que abrir o painel (ver
  // filtrosAbertos). "Todo o histórico" cobre o caso de "ver todos os meses".
  get rotuloFiltroMobile(): string {
    const periodo = this.filtroMes && this.filtroAno
      ? `${MESES_NOMES[this.filtroMes - 1]}/${this.filtroAno}`
      : 'Todo o histórico';
    const categoria = this.nomeCategoriaFiltro;
    return categoria ? `${periodo} · ${categoria}` : periodo;
  }

  // Mensagem do empty-state quando não há nenhum gasto no período/categoria
  // selecionado - combina os dois (mês/ano e categoria).
  get mensagemVazio(): string {
    const periodo = this.filtroAno
      ? (this.filtroMes ? `${MESES_NOMES[this.filtroMes - 1]}/${this.filtroAno}` : `${this.filtroAno}`)
      : '';
    const partes = [periodo, this.nomeCategoriaFiltro].filter((p): p is string => !!p);
    return partes.length > 0
      ? `Nenhum gasto encontrado para ${partes.join(' · ')}.`
      : 'Nenhum gasto cadastrado ainda.';
  }

  // true quando há algo fora do padrão pra "Limpar filtros" desfazer - mês/ano
  // diferentes do atual, categoria selecionada, ou modo "ver todos os meses".
  // Controla a visibilidade do botão nos dois layouts: no mobile ele fica dentro do
  // painel colapsável; no desktop, sempre visível junto dos campos (sem painel). Em
  // ambos, só aparece quando há algo pra limpar (ver template) - exceto no caso
  // abaixo, onde "limpar" e "Ver mês atual" fariam exatamente a mesma coisa.
  get podeLimparFiltros(): boolean {
    // Modo histórico (sem período) E sem categoria: aqui "Ver mês atual" já reseta
    // pro mês corrente sozinho (a categoria, sem filtro, não tem o que mudar) -
    // mostrar as duas ações lado a lado no desktop seria redundante.
    if (this.filtroMes === null && this.filtroAno === null && this.filtroCategoriaId === null) {
      return false;
    }
    const hoje = new Date();
    return this.filtroCategoriaId !== null
      || this.filtroMes !== hoje.getMonth() + 1
      || this.filtroAno !== hoje.getFullYear();
  }

  // Volta ao estado padrão (mês/ano atuais, sem categoria) de uma vez só - diferente
  // de alternarFiltroMes(), que só afeta o período. No mobile não mexe em
  // filtrosAbertos: o painel já não se fecha sozinho em nenhum outro fluxo (ver
  // comentário em carregar()), então continua aberto aqui também, que é justamente
  // o requisito.
  limparFiltrosPainel(): void {
    const hoje = new Date();
    this.aplicarFiltro(hoje.getMonth() + 1, hoje.getFullYear(), null);
  }

  // Alterna entre "ver todos os meses" (sem filtro de período) e "ver mês atual"
  // (filtrado no mês corrente) - preservando a categoria (se houver) nos dois casos,
  // diferente de limparFiltrosPainel(), que reseta tudo. Antes era um botão que só
  // limpava o período e ficava desabilitado depois (sem jeito de voltar a filtrar
  // por mês sem mexer nos <mat-select> de Mês/Ano); agora sempre alterna pro estado
  // oposto.
  get rotuloToggleMes(): string {
    return this.filtroMes || this.filtroAno ? 'Ver todos os meses' : 'Ver mês atual';
  }

  alternarFiltroMes(): void {
    if (this.filtroMes || this.filtroAno) {
      this.aplicarFiltro(null, null, this.filtroCategoriaId);
    } else {
      const hoje = new Date();
      this.aplicarFiltro(hoje.getMonth() + 1, hoje.getFullYear(), this.filtroCategoriaId);
    }
  }

  onMesAnoChange(): void {
    this.aplicarFiltro(this.mesSelecionado, this.anoSelecionado, this.filtroCategoriaId);
  }

  // filtroCategoriaId já foi atualizado pelo [(ngModel)] do <mat-select> antes desse
  // handler rodar - preserva o período (mês/ano) atual, incluindo "ver todos os
  // meses" (null), em vez de reaplicar o padrão do mês corrente.
  onCategoriaFiltroChange(): void {
    this.aplicarFiltro(this.filtroMes, this.filtroAno, this.filtroCategoriaId);
  }

  // Atualiza o estado (e recarrega) diretamente, em vez de só navegar e confiar na
  // assinatura de queryParamMap pra reagir - se a URL de destino for igual à atual
  // (ex: "ver todos os meses" quando a tela já tinha aberto sem mes/ano na URL, com o
  // padrão do mês atual aplicado só internamente), o Router não dispara uma nova
  // navegação, e a assinatura nunca reagiria. A chamada a router.navigate() abaixo só
  // mantém a URL compartilhável/refletindo o filtro atual, sem ser a fonte da verdade.
  private aplicarFiltro(mes: number | null, ano: number | null, categoriaId: number | null): void {
    this.filtroMes = mes;
    this.filtroAno = ano;
    this.filtroCategoriaId = categoriaId;
    this.mesSelecionado = mes ?? new Date().getMonth() + 1;
    this.anoSelecionado = ano ?? new Date().getFullYear();
    this.carregar();

    const queryParams: Record<string, string | number> = {};
    if (mes) {
      queryParams['mes'] = mes;
    }
    if (ano) {
      queryParams['ano'] = ano;
    }
    if (categoriaId) {
      queryParams['categoriaId'] = categoriaId;
    }
    this.router.navigate(['/gastos'], { queryParams, replaceUrl: true });
  }

  // Carrega a 1ª página da listagem (mês/ano/categoria vão como filtro do
  // servidor - ver GET /api/gastos/pagina). Chamado a cada troca de filtro e
  // depois de cada criação/edição/exclusão/importação, sempre voltando pro topo.
  carregar(): void {
    this.carregando = true;
    this.erro = false;
    this.paginaAtual = 0;
    this.temMais = false;
    this.carregarOpcoesCategoriaFiltro();

    this.gastoService.listarPaginado({
      page: 0,
      size: this.tamanhoPagina,
      mes: this.filtroMes,
      ano: this.filtroAno,
      categoriaId: this.filtroCategoriaId
    }).subscribe({
      next: (pagina) => {
        this.gastos = pagina.conteudo;
        this.temMais = !pagina.ultima;
        this.carregando = false;
        // Sem gastos no período/categoria filtrado: abre o painel de filtros
        // sozinho no mobile - é exatamente quando o usuário precisa mexer nele.
        // Só ABRE automaticamente, nunca fecha sozinho: se fechasse a cada
        // carregar() com resultado, o painel recolheria embaixo do dedo do
        // usuário no meio de uma troca de Mês/Ano (cada <mat-select> já dispara
        // onMesAnoChange -> carregar() na hora) antes dele terminar de ajustar
        // os dois campos - fechar é sempre um toque explícito no botão.
        if (this.gastos.length === 0) {
          this.filtrosAbertos = true;
        }
      },
      error: () => {
        // Limpa os gastos do filtro anterior antes de mostrar o erro, pra não
        // ficar exibindo dados desatualizados com o filtro novo no topo.
        this.gastos = [];
        this.carregando = false;
        this.erro = true;
      }
    });
  }

  // Botão "Carregar mais": busca a próxima página e ANEXA ao que já está na tela.
  // Um erro aqui só mostra um aviso - não derruba a lista já carregada nem cai no
  // estado de erro da tela inteira.
  carregarMais(): void {
    if (this.carregandoMais || !this.temMais) {
      return;
    }
    this.carregandoMais = true;
    this.gastoService.listarPaginado({
      page: this.paginaAtual + 1,
      size: this.tamanhoPagina,
      mes: this.filtroMes,
      ano: this.filtroAno,
      categoriaId: this.filtroCategoriaId
    }).subscribe({
      next: (pagina) => {
        this.paginaAtual += 1;
        this.gastos = [...this.gastos, ...pagina.conteudo];
        this.temMais = !pagina.ultima;
        this.carregandoMais = false;
      },
      error: (erro) => {
        this.carregandoMais = false;
        this.notificacao.erro(this.notificacao.mensagemDeErro(erro));
      }
    });
  }

  // Opções do dropdown "Filtrar por categoria" - categorias com pelo menos um
  // gasto (qualquer período). Recarregado a cada carregar() pra refletir uma
  // categoria que ganhou seu primeiro gasto (ex: importação). Se a categoria
  // filtrada sumiu da lista (foi excluída), reseta pra "Todas".
  private carregarOpcoesCategoriaFiltro(): void {
    this.categoriaService.listarComGastos().subscribe({
      next: (categorias) => {
        this.opcoesCategoriaFiltro = categorias;
        if (this.filtroCategoriaId !== null && !categorias.some((c) => c.id === this.filtroCategoriaId)) {
          this.filtroCategoriaId = null;
        }
      },
      error: () => { /* dropdown auxiliar; sem ele o filtro por categoria só não aparece */ }
    });
  }

  novoGasto(): void {
    this.abrirFormularioGasto();
  }

  private abrirFormularioGasto(): void {
    const ref = this.dialog.open<GastoFormDialogComponent, GastoFormDialogData, GastoFormResultado>(
      GastoFormDialogComponent,
      { data: { gasto: null }, width: '480px', maxWidth: '95vw' }
    );

    ref.afterClosed().subscribe((resultado) => {
      if (!resultado) {
        return;
      }
      if (resultado.tipo === 'recorrente') {
        this.gastoRecorrenteService.cadastrar(resultado.recorrente).subscribe({
          next: () => {
            this.notificacao.sucesso('Gasto recorrente cadastrado com sucesso!');
            this.carregar();
          },
          error: (erro) => this.notificacao.erro(this.notificacao.mensagemDeErro(erro))
        });
        return;
      }
      if (resultado.tipo === 'parcelada') {
        this.compraParceladaService.cadastrar(resultado.parcelada).subscribe({
          next: (compra) => {
            this.notificacao.sucesso(`Compra parcelada cadastrada com sucesso! ${compra.numeroParcelas} parcelas lançadas.`);
            this.carregar();
          },
          error: (erro) => this.notificacao.erro(this.notificacao.mensagemDeErro(erro))
        });
        return;
      }
      this.gastoService.cadastrar(resultado.gasto).subscribe({
        next: (gastoCriado) => {
          this.notificacao.sucesso('Gasto cadastrado com sucesso!');
          this.carregar();
          this.verificarOrcamentoExcedido(gastoCriado);
        },
        error: (erro) => this.notificacao.erro(this.notificacao.mensagemDeErro(erro))
      });
    });
  }

  private verificarOrcamentoExcedido(gasto: Gasto): void {
    if (!gasto.orcamentoId) {
      return;
    }
    const [ano, mes] = gasto.data.split('-').map(Number);
    this.orcamentoService.verMes(mes, ano).subscribe({
      next: (orcamentos) => {
        const orcamento = orcamentos.find((o) => o.id === gasto.orcamentoId);
        if (!orcamento) {
          return;
        }
        if (orcamento.ultrapassou) {
          this.snackBar.open(
            `Atenção: o orçamento de "${orcamento.categoria}" foi ultrapassado neste mês!`,
            'Fechar',
            { duration: 7000, panelClass: 'snack-alerta' }
          );
        } else if (orcamento.completo) {
          this.snackBar.open(
            `O orçamento de "${orcamento.categoria}" atingiu exatamente o limite neste mês.`,
            'Fechar',
            { duration: 6000, panelClass: 'snack-atencao' }
          );
        } else if (orcamento.proximoDoLimite) {
          this.snackBar.open(
            `Atenção: o orçamento de "${orcamento.categoria}" está próximo do limite neste mês.`,
            'Fechar',
            { duration: 6000, panelClass: 'snack-atencao' }
          );
        }
      },
      error: () => { /* verificação de orçamento é auxiliar; falha aqui não deve incomodar o usuário */ }
    });
  }

  editar(gasto: Gasto): void {
    const ref = this.dialog.open<GastoFormDialogComponent, GastoFormDialogData, GastoFormResultado>(
      GastoFormDialogComponent,
      { data: { gasto }, width: '480px', maxWidth: '95vw' }
    );

    ref.afterClosed().subscribe((resultado) => {
      // Editando um gasto existente o diálogo nunca oferece "tornar recorrente",
      // então o resultado é sempre do tipo 'gasto'.
      if (!resultado || resultado.tipo !== 'gasto') {
        return;
      }
      this.gastoService.atualizar(gasto.id!, resultado.gasto).subscribe({
        next: (gastoAtualizado) => {
          this.notificacao.sucesso('Gasto atualizado com sucesso!');
          this.carregar();
          this.verificarOrcamentoExcedido(gastoAtualizado);
        },
        error: (erro) => this.notificacao.erro(this.notificacao.mensagemDeErro(erro))
      });
    });
  }

  excluir(gasto: Gasto): void {
    // Parcela de compra parcelada não é excluível sozinha (deixaria o parcelamento
    // incoerente) - o botão/menu de excluir nem aparece nesse caso, e o backend
    // rejeita. Este método só roda para gasto avulso.
    const ref = this.dialog.open<ConfirmDialogComponent, ConfirmDialogData, boolean>(ConfirmDialogComponent, {
      data: {
        titulo: 'Excluir gasto',
        mensagem: `Tem certeza que deseja excluir "${gasto.descricao}"?`
      }
    });

    ref.afterClosed().subscribe((confirmado) => {
      if (!confirmado) {
        return;
      }
      this.gastoService.excluir(gasto.id!).subscribe({
        next: () => {
          this.notificacao.sucesso('Gasto excluído com sucesso!');
          this.carregar();
        },
        error: (erro) => this.notificacao.erro(this.notificacao.mensagemDeErro(erro))
      });
    });
  }

  exportarTodos(): void {
    this.gastoService.listarTodos().subscribe({
      next: (gastos) => {
        if (gastos.length === 0) {
          this.notificacao.erro('Nenhum gasto para exportar.');
          return;
        }
        exportarGastosXlsx(gastos);
      },
      error: (erro) => this.notificacao.erro(this.notificacao.mensagemDeErro(erro))
    });
  }

  exportarExibidos(): void {
    if (this.gastos.length === 0) {
      this.notificacao.erro('Nenhum gasto para exportar.');
      return;
    }
    exportarGastosXlsx(this.gastos);
  }

  baixarModeloImportacao(): void {
    baixarModeloImportacaoGastos();
  }

  importarPlanilha(): void {
    this.inputArquivo.nativeElement.click();
  }

  async onArquivoSelecionado(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const arquivo = input.files?.[0] ?? null;
    input.value = '';
    if (!arquivo) {
      return;
    }

    // O spinner do trio carregando/erro/vazio cobre a leitura do .xlsx até o
    // primeiro diálogo abrir; daí em diante os diálogos do orquestrador cobrem a
    // tela. Todas as mensagens (linhas ignoradas, resumos, "já cadastrado") são
    // do orquestrador - aqui só cuidamos do estado da lista.
    this.carregando = true;
    const resultado = await this.orquestradorImportacao.importarDeArquivo(arquivo);
    this.carregando = false;

    if (resultado.status !== 'ok') {
      return;
    }
    // A importação pode ter criado categorias - reflete o emoji delas na tabela.
    this.categoriasPorId = new Map(resultado.categoriasAtualizadas.map((c) => [c.id!, c]));
    this.carregar();
  }

}
