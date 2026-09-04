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
import { firstValueFrom } from 'rxjs';
import { GastoService } from '../../../services/gasto.service';
import { OrcamentoService } from '../../../services/orcamento.service';
import { CategoriaService } from '../../../services/categoria.service';
import { GastoRecorrenteService } from '../../../services/gasto-recorrente.service';
import { CompraParceladaService } from '../../../services/compra-parcelada.service';
import { Gasto } from '../../../models/gasto.model';
import { Orcamento } from '../../../models/orcamento.model';
import { Categoria, Subcategoria } from '../../../models/categoria.model';
import {
  GastoFormDialogComponent,
  GastoFormDialogData,
  GastoFormResultado
} from '../gasto-form-dialog/gasto-form-dialog.component';
import { ConfirmDialogComponent, ConfirmDialogData } from '../../../shared/confirm-dialog/confirm-dialog.component';
import { EmptyStateComponent } from '../../../shared/empty-state/empty-state.component';
import { ErroCarregamentoComponent } from '../../../shared/erro-carregamento/erro-carregamento.component';
import { baixarModeloImportacaoGastos, exportarGastosXlsx } from '../../../core/xlsx-exporter';
import { lerPlanilhaGastos, LinhaImportacao } from '../../../core/xlsx-importer';
import {
  ImportarRevisaoDialogComponent,
  ImportarRevisaoDialogData
} from '../importar-revisao-dialog/importar-revisao-dialog.component';
import { ImportarProgressoDialogComponent } from '../importar-progresso-dialog/importar-progresso-dialog.component';
import {
  ImportarVinculoOrcamentoDialogComponent,
  ImportarVinculoOrcamentoDialogData,
  VinculoImportacao,
  DecisaoVinculo
} from '../importar-vinculo-orcamento-dialog/importar-vinculo-orcamento-dialog.component';
import {
  ImportarAtualizacaoDialogComponent,
  ImportarAtualizacaoDialogData,
  AtualizacaoImportacao,
  DecisaoAtualizacao
} from '../importar-atualizacao-dialog/importar-atualizacao-dialog.component';

const NOMES_MESES_COMPLETO = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
];

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

  readonly meses = NOMES_MESES_COMPLETO.map((nome, i) => ({ valor: i + 1, nome }));
  readonly anos: number[];

  filtroMes: number | null = null;
  filtroAno: number | null = null;
  filtroCategoria: string | null = null;

  // Refletem sempre filtroMes/filtroAno pra exibição nos <mat-select> - quando o
  // filtro de período está limpo ("ver todos os meses"), continuam mostrando o
  // mês/ano atual, pronto pra caso o usuário volte a filtrar por período.
  mesSelecionado = new Date().getMonth() + 1;
  anoSelecionado = new Date().getFullYear();

  // true só na primeiríssima leitura dos query params (ver ngOnInit) - depois disso,
  // a ausência de mes/ano na URL significa "usuário limpou o filtro de propósito"
  // (verTodosOsMeses), não "aplique o padrão do mês atual" de novo.
  private primeiraCarga = true;

  // Opções do <mat-select> de filtro por categoria - derivadas de gastosDoPeriodo
  // (ver atualizarOpcoesCategoriaFiltro), não de uma chamada à parte: só entram
  // categorias com gasto no período ATUAL, diferente de todasCategorias (usada na
  // importação/emoji da tabela, que precisa de todas, mesmo sem gasto ainda).
  opcoesCategoriaFiltro: Categoria[] = [];

  // Gastos do período (mês/ano) selecionado, ANTES do filtro de categoria - fonte
  // de opcoesCategoriaFiltro. Precisa ser antes do filtro pra não fazer a lista de
  // categorias murchar pra uma opção só assim que o usuário escolhe uma.
  private gastosDoPeriodo: Gasto[] = [];

  private todasCategorias: Categoria[] = [];
  private todasSubcategorias: Subcategoria[] = [];
  private categoriasPorId = new Map<number, Categoria>();
  // Só pro rótulo "Orçamento: ..." nos detalhes do cartão (mobile) - o Gasto traz
  // orcamentoId, mas não o nome do orçamento vinculado.
  private orcamentosPorId = new Map<number, Orcamento>();
  // Resultado da resolução texto -> categoria/subcategoria gerenciada da importação
  // em andamento (ver resolverCategorias) - chave é chaveCategoria(categoria, subcategoria).
  private categoriasResolvidas = new Map<string, { categoriaId: number; subcategoriaId: number | null }>();

  constructor(
    private readonly gastoService: GastoService,
    private readonly orcamentoService: OrcamentoService,
    private readonly categoriaService: CategoriaService,
    private readonly gastoRecorrenteService: GastoRecorrenteService,
    private readonly compraParceladaService: CompraParceladaService,
    private readonly dialog: MatDialog,
    private readonly snackBar: MatSnackBar,
    private readonly route: ActivatedRoute,
    private readonly router: Router
  ) {
    const anoAtual = new Date().getFullYear();
    this.anos = Array.from({ length: 6 }, (_, i) => anoAtual - 2 + i);
  }

  ngOnInit(): void {
    this.categoriaService.listarVisiveis().subscribe({
      next: (categorias) => {
        this.todasCategorias = categorias;
        this.categoriasPorId = new Map(categorias.map((c) => [c.id!, c]));
      },
      error: () => { /* usado só pro emoji na tabela e na importação; sem ela ainda funciona sem emoji */ }
    });
    this.categoriaService.listarTodasSubcategorias().subscribe({
      next: (subcategorias) => { this.todasSubcategorias = subcategorias; },
      error: () => { /* usado só na resolução de categoria durante a importação */ }
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
      this.filtroCategoria = params.get('categoria');
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
    return categoriaId ? (this.categoriasPorId.get(categoriaId)?.emoji ?? '') : '';
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

  // Só reflete a categoria agora: o período (mês/ano) já fica sempre visível nos
  // <mat-select> no topo da tela, então repeti-lo aqui na faixa "Mostrando gastos
  // de..." seria redundante - essa faixa só aparece pra deixar claro que veio de um
  // clique de categoria no Dashboard (ver limparFiltro).
  get descricaoFiltro(): string {
    return this.filtroCategoria ?? '';
  }

  // Mensagem do empty-state quando não há nenhum gasto no período/categoria
  // selecionado - combina os dois, diferente de descricaoFiltro (só categoria).
  get mensagemVazio(): string {
    const periodo = this.filtroAno
      ? (this.filtroMes ? `${NOMES_MESES_COMPLETO[this.filtroMes - 1]}/${this.filtroAno}` : `${this.filtroAno}`)
      : '';
    const partes = [periodo, this.filtroCategoria].filter((p): p is string => !!p);
    return partes.length > 0
      ? `Nenhum gasto encontrado para ${partes.join(' · ')}.`
      : 'Nenhum gasto cadastrado ainda.';
  }

  // Reset completo (categoria E período) - usado pelo botão "Ver todos os gastos" da
  // faixa de filtro de categoria. Como não é mais a primeira carga, cair sem mes/ano
  // na URL mostra literalmente tudo, sem reaplicar o padrão do mês atual.
  limparFiltro(): void {
    this.router.navigate(['/gastos']);
  }

  // Alterna entre "ver todos os meses" (sem filtro de período) e "ver mês atual"
  // (filtrado no mês corrente) - preservando a categoria (se houver) nos dois casos,
  // diferente de limparFiltro(), que reseta tudo. Antes era um botão que só limpava o
  // período e ficava desabilitado depois (sem jeito de voltar a filtrar por mês sem
  // mexer nos <mat-select> de Mês/Ano); agora sempre alterna pro estado oposto.
  get rotuloToggleMes(): string {
    return this.filtroMes || this.filtroAno ? 'Ver todos os meses' : 'Ver mês atual';
  }

  alternarFiltroMes(): void {
    if (this.filtroMes || this.filtroAno) {
      this.aplicarFiltro(null, null, this.filtroCategoria);
    } else {
      const hoje = new Date();
      this.aplicarFiltro(hoje.getMonth() + 1, hoje.getFullYear(), this.filtroCategoria);
    }
  }

  onMesAnoChange(): void {
    this.aplicarFiltro(this.mesSelecionado, this.anoSelecionado, this.filtroCategoria);
  }

  // filtroCategoria já foi atualizado pelo [(ngModel)] do <mat-select> antes desse
  // handler rodar - preserva o período (mês/ano) atual, incluindo "ver todos os
  // meses" (null), em vez de reaplicar o padrão do mês corrente.
  onCategoriaFiltroChange(): void {
    this.aplicarFiltro(this.filtroMes, this.filtroAno, this.filtroCategoria);
  }

  // Atualiza o estado (e recarrega) diretamente, em vez de só navegar e confiar na
  // assinatura de queryParamMap pra reagir - se a URL de destino for igual à atual
  // (ex: "ver todos os meses" quando a tela já tinha aberto sem mes/ano na URL, com o
  // padrão do mês atual aplicado só internamente), o Router não dispara uma nova
  // navegação, e a assinatura nunca reagiria. A chamada a router.navigate() abaixo só
  // mantém a URL compartilhável/refletindo o filtro atual, sem ser a fonte da verdade.
  private aplicarFiltro(mes: number | null, ano: number | null, categoria: string | null): void {
    this.filtroMes = mes;
    this.filtroAno = ano;
    this.filtroCategoria = categoria;
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
    if (categoria) {
      queryParams['categoria'] = categoria;
    }
    this.router.navigate(['/gastos'], { queryParams, replaceUrl: true });
  }

  carregar(): void {
    this.carregando = true;
    this.erro = false;

    const origem$ = this.filtroAno
      ? this.gastoService.listarPorPeriodo(...this.intervaloFiltro(this.filtroAno, this.filtroMes))
      : this.gastoService.listarTodos();

    origem$.subscribe({
      next: (gastos) => {
        this.gastosDoPeriodo = gastos;
        this.atualizarOpcoesCategoriaFiltro();
        this.gastos = this.filtroCategoria
          ? gastos.filter((g) => (g.categoria ?? '').trim().toLowerCase() === this.filtroCategoria!.trim().toLowerCase())
          : gastos;
        this.carregando = false;
      },
      error: () => {
        // Limpa os gastos do filtro anterior antes de mostrar o erro, pra não
        // ficar exibindo dados desatualizados com o filtro novo no topo.
        this.gastos = [];
        this.gastosDoPeriodo = [];
        this.opcoesCategoriaFiltro = [];
        this.carregando = false;
        this.erro = true;
      }
    });
  }

  // Deriva as opções do filtro a partir de gastosDoPeriodo (sem chamada extra à
  // API): só entram categorias com pelo menos um gasto no período atual - que já é
  // o histórico inteiro quando "Ver todos os meses" está ativo (gastosDoPeriodo vem
  // de listarTodos() nesse caso, ver carregar()). Em ordem alfabética: essa lista só
  // existe depois que os gastos do período chegam, e esperar todasCategorias (que
  // carrega à parte, em paralelo) pra ordenar pela preferência do usuário entraria
  // em corrida com ela.
  private atualizarOpcoesCategoriaFiltro(): void {
    const porId = new Map<number, Categoria>();
    for (const gasto of this.gastosDoPeriodo) {
      if (gasto.categoriaId == null || porId.has(gasto.categoriaId)) {
        continue;
      }
      porId.set(gasto.categoriaId, this.categoriasPorId.get(gasto.categoriaId) ?? {
        id: gasto.categoriaId,
        nome: gasto.categoria ?? '',
        emoji: ''
      });
    }
    this.opcoesCategoriaFiltro = Array.from(porId.values())
      .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));

    // A categoria filtrada deixou de ter gasto no período atual (ex: trocou de mês) -
    // reseta pra "Todas" em vez de deixar a tela vazia sem explicação.
    const categoriaAindaExiste = this.opcoesCategoriaFiltro.some((c) =>
      c.nome.trim().toLowerCase() === this.filtroCategoria?.trim().toLowerCase());
    if (this.filtroCategoria && !categoriaAindaExiste) {
      this.filtroCategoria = null;
    }
  }

  private intervaloFiltro(ano: number, mes: number | null): [string, string] {
    if (mes) {
      const inicio = new Date(ano, mes - 1, 1);
      const fim = new Date(ano, mes, 0);
      return [this.formatarData(inicio), this.formatarData(fim)];
    }
    return [`${ano}-01-01`, `${ano}-12-31`];
  }

  private formatarData(data: Date): string {
    const ano = data.getFullYear();
    const mes = String(data.getMonth() + 1).padStart(2, '0');
    const dia = String(data.getDate()).padStart(2, '0');
    return `${ano}-${mes}-${dia}`;
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
            this.mostrarSucesso('Gasto recorrente cadastrado com sucesso!');
            this.carregar();
          },
          error: (erro) => this.mostrarErro(this.mensagemErro(erro))
        });
        return;
      }
      if (resultado.tipo === 'parcelada') {
        this.compraParceladaService.cadastrar(resultado.parcelada).subscribe({
          next: (compra) => {
            this.mostrarSucesso(`Compra parcelada cadastrada com sucesso! ${compra.numeroParcelas} parcelas lançadas.`);
            this.carregar();
          },
          error: (erro) => this.mostrarErro(this.mensagemErro(erro))
        });
        return;
      }
      this.gastoService.cadastrar(resultado.gasto).subscribe({
        next: (gastoCriado) => {
          this.mostrarSucesso('Gasto cadastrado com sucesso!');
          this.carregar();
          this.verificarOrcamentoExcedido(gastoCriado);
        },
        error: (erro) => this.mostrarErro(this.mensagemErro(erro))
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
          this.mostrarSucesso('Gasto atualizado com sucesso!');
          this.carregar();
          this.verificarOrcamentoExcedido(gastoAtualizado);
        },
        error: (erro) => this.mostrarErro(this.mensagemErro(erro))
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
          this.mostrarSucesso('Gasto excluído com sucesso!');
          this.carregar();
        },
        error: (erro) => this.mostrarErro(this.mensagemErro(erro))
      });
    });
  }

  exportarTodos(): void {
    this.gastoService.listarTodos().subscribe({
      next: (gastos) => {
        if (gastos.length === 0) {
          this.mostrarErro('Nenhum gasto para exportar.');
          return;
        }
        exportarGastosXlsx(gastos);
      },
      error: (erro) => this.mostrarErro(this.mensagemErro(erro))
    });
  }

  exportarExibidos(): void {
    if (this.gastos.length === 0) {
      this.mostrarErro('Nenhum gasto para exportar.');
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

    // Cobre a leitura/parsing do .xlsx (pode levar um tempo perceptível) até a
    // revisão abrir - reaproveita o mesmo spinner do carregamento da lista (ver
    // trio carregando/erro/vazio no template), que fica escondido atrás do diálogo
    // assim que ele abrir. Continua ligado por toda a importação (ver
    // resolverCategoriasEProsseguir e cia.) - cada etapa intermediária ou desliga
    // explicitamente (erro/cancelamento) ou termina chamando carregar(), que já
    // cuida de desligar sozinho.
    this.carregando = true;

    let linhas: LinhaImportacao[];
    try {
      linhas = await lerPlanilhaGastos(arquivo);
    } catch {
      this.carregando = false;
      this.mostrarErro('Não foi possível ler o arquivo. Verifique se é uma planilha .xlsx válida.');
      return;
    }

    if (linhas.length === 0) {
      this.carregando = false;
      this.mostrarErro('A planilha não tem nenhuma linha de dados para importar.');
      return;
    }

    const ref = this.dialog.open<ImportarRevisaoDialogComponent, ImportarRevisaoDialogData, LinhaImportacao[]>(
      ImportarRevisaoDialogComponent,
      { data: { linhas }, width: '760px', maxWidth: '95vw' }
    );

    ref.afterClosed().subscribe((linhasConfirmadas) => {
      if (!linhasConfirmadas || linhasConfirmadas.length === 0) {
        // Usuário cancelou a revisão - desliga o loading, senão fica preso na tela
        // (nada mais vai chamar carregar() pra desligá-lo).
        this.carregando = false;
        return;
      }
      this.resolverCategoriasEProsseguir(linhasConfirmadas);
    });
  }

  // Categoria/subcategoria da planilha chegam como texto puro; aqui cada uma vira
  // uma categoria/subcategoria gerenciada de verdade antes de prosseguir - criando
  // uma privada nova quando o texto não bate (sem diferenciar maiúsculas/minúsculas)
  // com nenhuma categoria já visível pro usuário, igual à migração feita no banco.
  private async resolverCategorias(linhas: LinhaImportacao[]): Promise<void> {
    const resolvidas = new Map<string, { categoriaId: number; subcategoriaId: number | null }>();
    let categorias = this.todasCategorias;
    let subcategorias = this.todasSubcategorias;

    for (const linha of linhas) {
      const chave = this.chaveCategoria(linha.categoria, linha.subcategoria);
      if (resolvidas.has(chave)) {
        continue;
      }

      let categoria = categorias.find((c) => c.nome.toLowerCase() === linha.categoria.trim().toLowerCase());
      if (!categoria) {
        categoria = await firstValueFrom(this.categoriaService.criar({ nome: linha.categoria.trim(), emoji: '📁' }));
        categorias = [...categorias, categoria];
      }

      let subcategoriaId: number | null = null;
      const nomeSub = linha.subcategoria?.trim();
      if (nomeSub) {
        let subcategoria = subcategorias.find((s) =>
          s.categoriaId === categoria!.id && s.nome.toLowerCase() === nomeSub.toLowerCase());
        if (!subcategoria) {
          subcategoria = await firstValueFrom(
            this.categoriaService.criarSubcategoria(categoria.id!, { nome: nomeSub, emoji: '📁' }));
          subcategorias = [...subcategorias, subcategoria];
        }
        subcategoriaId = subcategoria.id!;
      }

      resolvidas.set(chave, { categoriaId: categoria.id!, subcategoriaId });
    }

    this.todasCategorias = categorias;
    this.categoriasPorId = new Map(categorias.map((c) => [c.id!, c]));
    this.todasSubcategorias = subcategorias;
    this.categoriasResolvidas = resolvidas;
  }

  private chaveCategoria(categoria: string, subcategoria: string | null): string {
    return `${categoria.trim().toLowerCase()}|${(subcategoria ?? '').trim().toLowerCase()}`;
  }

  private resolverCategoriasEProsseguir(linhas: LinhaImportacao[]): void {
    this.resolverCategorias(linhas)
      .then(() => this.prepararAtualizacao(linhas))
      .catch(() => {
        // Falha de rede ao criar categoria/subcategoria nova - aborta aqui, então
        // ninguém mais vai chamar carregar() pra desligar o loading.
        this.carregando = false;
        this.mostrarErro('Não foi possível preparar as categorias desta planilha para importação.');
      });
  }

  private prepararAtualizacao(linhas: LinhaImportacao[]): void {
    this.gastoService.listarTodos().subscribe({
      next: (gastosAtuais) => {
        const mapaGastos = new Map(gastosAtuais.map((g) => [g.id, g]));
        const atualizacoes: AtualizacaoImportacao[] = [];
        const linhasNovas: LinhaImportacao[] = [];
        const linhasSuspeitas: LinhaImportacao[] = [];
        const linhasPossivelEdicao: LinhaImportacao[] = [];
        let semAlteracao = 0;

        for (const linha of linhas) {
          // Descrição, valor, categoria e data batem exatamente com um gasto já
          // cadastrado - é a mesma planilha (ou os mesmos dados) sendo reimportada.
          // Nunca cria como gasto novo aqui, com ou sem coluna ID e mesmo que o
          // usuário confirme "importar mesmo assim" mais adiante: só avisa no final.
          const duplicataExata = gastosAtuais.some((g) => !this.gastoMudou(g, linha));
          if (duplicataExata) {
            semAlteracao++;
            continue;
          }

          if (linha.id != null) {
            const existente = mapaGastos.get(linha.id);
            if (!existente) {
              // tinha ID, mas não corresponde a nenhum gasto atual - pode ser de uma
              // exportação antiga ou o gasto já foi excluído; não cria sem perguntar
              linhasSuspeitas.push(linha);
              continue;
            }
            // duplicataExata já garantiu que os dados são diferentes dos de existente
            atualizacoes.push({ linha, existente, atualizar: true });
            continue;
          }

          // Sem ID: descrição e categoria batem com um gasto existente, mas valor
          // ou data são diferentes - provavelmente é uma tentativa de EDITAR aquele gasto,
          // mas sem ID não há como ter certeza de qual gasto é (nem atualizá-lo). Sem essa
          // checagem, a linha seria criada como um gasto novo, duplicando o original.
          const possivelEdicao = gastosAtuais.some((g) =>
            g.descricao.trim().toLowerCase() === linha.descricao.trim().toLowerCase()
            && (g.categoria ?? '').trim().toLowerCase() === linha.categoria.trim().toLowerCase()
            && this.gastoMudou(g, linha)
          );
          if (possivelEdicao) {
            linhasPossivelEdicao.push(linha);
            continue;
          }

          linhasNovas.push(linha);
        }

        this.confirmarAtualizacoes(atualizacoes, linhasNovas, linhasSuspeitas, linhasPossivelEdicao, semAlteracao);
      },
      error: () => this.prepararVinculoOrcamento(linhas)
    });
  }

  private confirmarAtualizacoes(
    atualizacoes: AtualizacaoImportacao[],
    linhasNovas: LinhaImportacao[],
    linhasSuspeitas: LinhaImportacao[],
    linhasPossivelEdicao: LinhaImportacao[],
    semAlteracao: number
  ): void {
    if (atualizacoes.length === 0) {
      this.confirmarLinhasSuspeitas(linhasNovas, linhasSuspeitas, linhasPossivelEdicao, semAlteracao);
      return;
    }

    const ref = this.dialog.open<
      ImportarAtualizacaoDialogComponent,
      ImportarAtualizacaoDialogData,
      DecisaoAtualizacao[]
    >(ImportarAtualizacaoDialogComponent, { data: { atualizacoes }, width: '820px', maxWidth: '95vw' });

    ref.afterClosed().subscribe((decisoes) => {
      const decididas = decisoes ?? [];
      const naoAtualizadas = atualizacoes.length - decididas.length;
      this.executarAtualizacoes(decididas, () =>
        this.confirmarLinhasSuspeitas(linhasNovas, linhasSuspeitas, linhasPossivelEdicao, semAlteracao + naoAtualizadas)
      );
    });
  }

  private confirmarLinhasSuspeitas(
    linhasNovas: LinhaImportacao[],
    linhasSuspeitas: LinhaImportacao[],
    linhasPossivelEdicao: LinhaImportacao[],
    semAlteracao: number
  ): void {
    if (linhasSuspeitas.length === 0) {
      this.confirmarLinhasPossivelEdicao(linhasNovas, linhasPossivelEdicao, semAlteracao);
      return;
    }

    const ref = this.dialog.open<ConfirmDialogComponent, ConfirmDialogData, boolean>(ConfirmDialogComponent, {
      data: {
        titulo: 'ID não encontrado',
        mensagem: `${linhasSuspeitas.length} linha(s) desta planilha têm um ID que não corresponde a nenhum `
          + 'gasto seu atual (o gasto pode já ter sido excluído, ou esta planilha é de uma exportação antiga). '
          + 'Os dados dessas linhas são diferentes de tudo que você já tem cadastrado, então não são uma '
          + 'duplicata - mas, por causa do ID estranho, prefira conferir antes de confirmar. Deseja importar '
          + 'estas linhas como gastos novos mesmo assim?'
      }
    });

    ref.afterClosed().subscribe((confirmado) => {
      if (!confirmado) {
        this.mostrarErro(
          `${linhasSuspeitas.length} linha(s) com ID não encontrado foram ignoradas (não importadas).`
        );
        this.confirmarLinhasPossivelEdicao(linhasNovas, linhasPossivelEdicao, semAlteracao);
        return;
      }
      this.confirmarLinhasPossivelEdicao([...linhasNovas, ...linhasSuspeitas], linhasPossivelEdicao, semAlteracao);
    });
  }

  private confirmarLinhasPossivelEdicao(
    linhasNovas: LinhaImportacao[],
    linhasPossivelEdicao: LinhaImportacao[],
    semAlteracao: number
  ): void {
    if (linhasPossivelEdicao.length === 0) {
      this.prepararVinculoOrcamento(linhasNovas, semAlteracao);
      return;
    }

    const ref = this.dialog.open<ConfirmDialogComponent, ConfirmDialogData, boolean>(ConfirmDialogComponent, {
      data: {
        titulo: 'Isto parece uma edição, não um gasto novo',
        mensagem: `${linhasPossivelEdicao.length} linha(s) têm a mesma descrição e categoria de um gasto já `
          + 'cadastrado, mas com valor ou data diferentes - parece que você editou um gasto existente. Só que '
          + 'esta planilha não tem a coluna ID, então não é possível ter certeza de qual gasto é (nem '
          + 'atualizá-lo automaticamente): se confirmar, um gasto NOVO será criado, e o antigo continuará como '
          + 'estava, duplicado. Para atualizar de verdade um gasto existente, cancele agora, clique em '
          + '"Exportar XLSX" para gerar um arquivo com a coluna ID, edite esse arquivo (não o modelo de '
          + 'importação) e reimporte-o. Deseja criar estas linhas como gastos novos mesmo assim?'
      }
    });

    ref.afterClosed().subscribe((confirmado) => {
      if (!confirmado) {
        this.mostrarErro(
          `${linhasPossivelEdicao.length} linha(s) que pareciam edições foram ignoradas (não importadas).`
        );
        this.prepararVinculoOrcamento(linhasNovas, semAlteracao);
        return;
      }
      this.prepararVinculoOrcamento([...linhasNovas, ...linhasPossivelEdicao], semAlteracao);
    });
  }

  private gastoMudou(existente: Gasto, linha: LinhaImportacao): boolean {
    return existente.descricao !== linha.descricao
      || Math.abs(existente.valor - (linha.valor ?? 0)) > 0.001
      || (existente.categoria ?? '').toLowerCase() !== linha.categoria.toLowerCase()
      || (existente.subcategoria ?? '').toLowerCase() !== (linha.subcategoria ?? '').toLowerCase()
      || existente.data !== linha.data;
  }

  private executarAtualizacoes(decisoes: DecisaoAtualizacao[], aposConcluir: () => void): void {
    if (decisoes.length === 0) {
      aposConcluir();
      return;
    }

    const progressoRef = this.dialog.open(ImportarProgressoDialogComponent, {
      disableClose: true,
      width: '360px',
      maxWidth: '95vw'
    });
    const instancia = progressoRef.componentInstance;
    instancia.total = decisoes.length;
    instancia.atual = 0;

    let sucesso = 0;
    let falha = 0;

    const processarProxima = (indice: number): void => {
      if (indice >= decisoes.length) {
        progressoRef.close();
        this.mostrarResumoAtualizacao(sucesso, falha);
        aposConcluir();
        return;
      }

      const decisao = decisoes[indice];
      const resolvida = this.categoriasResolvidas.get(this.chaveCategoria(decisao.linha.categoria, decisao.linha.subcategoria));
      const gasto: Gasto = {
        descricao: decisao.linha.descricao,
        valor: decisao.linha.valor!,
        categoriaId: resolvida!.categoriaId,
        subcategoriaId: resolvida!.subcategoriaId,
        data: decisao.linha.data!,
        orcamentoId: decisao.existente.orcamentoId ?? null
      };

      this.gastoService.atualizar(decisao.existente.id!, gasto).subscribe({
        next: () => {
          sucesso++;
          instancia.atual = indice + 1;
          processarProxima(indice + 1);
        },
        error: () => {
          falha++;
          instancia.atual = indice + 1;
          processarProxima(indice + 1);
        }
      });
    };

    processarProxima(0);
  }

  private mostrarResumoAtualizacao(sucesso: number, falha: number): void {
    if (falha === 0) {
      this.mostrarSucesso(`${sucesso} gasto(s) atualizado(s) com sucesso!`);
    } else {
      this.snackBar.open(
        `${sucesso} gasto(s) atualizado(s) com sucesso, ${falha} falharam.`,
        'Fechar',
        { duration: 6000 }
      );
    }
  }

  private prepararVinculoOrcamento(linhas: LinhaImportacao[], semAlteracao = 0): void {
    if (semAlteracao > 0) {
      // Linhas com descrição, valor, categoria e data idênticos a um gasto já cadastrado
      // (com ou sem coluna ID): nunca duplica, mas avisa para o usuário não achar que a
      // importação "não fez nada".
      this.snackBar.open(
        semAlteracao === 1
          ? 'Este dado já está cadastrado. Como não houve edição, nada foi atualizado.'
          : `${semAlteracao} dado(s) desta planilha já estão cadastrados. Como não houve edição, nada foi atualizado.`,
        'Fechar',
        { duration: 5000 }
      );
    }

    if (linhas.length === 0) {
      this.carregar();
      return;
    }

    this.orcamentoService.listarTodos().subscribe({
      next: (orcamentos) => {
        const vinculos = this.encontrarVinculosPossiveis(linhas, orcamentos);
        if (vinculos.length === 0) {
          this.executarImportacao(linhas);
          return;
        }

        const ref = this.dialog.open<
          ImportarVinculoOrcamentoDialogComponent,
          ImportarVinculoOrcamentoDialogData,
          DecisaoVinculo[]
        >(ImportarVinculoOrcamentoDialogComponent, { data: { vinculos }, width: '760px', maxWidth: '95vw' });

        ref.afterClosed().subscribe((decisoes) => {
          const mapaVinculos = new Map((decisoes ?? []).map((d) => [d.linhaNumero, d.orcamentoId]));
          this.executarImportacao(linhas, mapaVinculos);
        });
      },
      error: () => this.executarImportacao(linhas)
    });
  }

  private encontrarVinculosPossiveis(linhas: LinhaImportacao[], orcamentos: Orcamento[]): VinculoImportacao[] {
    const vinculos: VinculoImportacao[] = [];
    for (const linha of linhas) {
      if (!linha.data) {
        continue;
      }
      const [ano, mes] = linha.data.split('-').map(Number);
      const opcoes = orcamentos
        .filter((o) => o.mes === mes && o.ano === ano)
        .sort((a, b) =>
          (a.categoria ?? '').localeCompare(b.categoria ?? '')
          || Number(!!a.subcategoria) - Number(!!b.subcategoria)
          || (a.subcategoria ?? '').localeCompare(b.subcategoria ?? ''));
      if (opcoes.length === 0) {
        continue;
      }
      // Prioriza o orçamento específico da subcategoria da linha (já resolvida em
      // resolverCategorias); só cai para o orçamento geral da categoria (sem
      // subcategoria) se não houver um específico.
      const resolvida = this.categoriasResolvidas.get(this.chaveCategoria(linha.categoria, linha.subcategoria));
      const especifico = resolvida?.subcategoriaId
        ? opcoes.find((o) => o.categoriaId === resolvida.categoriaId && o.subcategoriaId === resolvida.subcategoriaId)
        : undefined;
      const geral = opcoes.find((o) => o.categoriaId === resolvida?.categoriaId && !o.subcategoriaId);
      vinculos.push({ linha, opcoes, orcamentoId: (especifico ?? geral)?.id ?? null });
    }
    return vinculos;
  }

  private executarImportacao(linhas: LinhaImportacao[], vinculos?: Map<number, number>): void {
    const progressoRef = this.dialog.open(ImportarProgressoDialogComponent, {
      disableClose: true,
      width: '360px',
      maxWidth: '95vw'
    });
    const instancia = progressoRef.componentInstance;
    instancia.total = linhas.length;
    instancia.atual = 0;

    let sucesso = 0;
    let falha = 0;

    const processarProxima = (indice: number): void => {
      if (indice >= linhas.length) {
        progressoRef.close();
        this.mostrarResumoImportacao(sucesso, falha);
        this.carregar();
        return;
      }

      const linha = linhas[indice];
      const resolvida = this.categoriasResolvidas.get(this.chaveCategoria(linha.categoria, linha.subcategoria));
      const gasto: Gasto = {
        descricao: linha.descricao,
        valor: linha.valor!,
        categoriaId: resolvida!.categoriaId,
        subcategoriaId: resolvida!.subcategoriaId,
        data: linha.data!,
        orcamentoId: vinculos?.get(linha.linha) ?? null
      };

      this.gastoService.cadastrar(gasto).subscribe({
        next: () => {
          sucesso++;
          instancia.atual = indice + 1;
          processarProxima(indice + 1);
        },
        error: () => {
          falha++;
          instancia.atual = indice + 1;
          processarProxima(indice + 1);
        }
      });
    };

    processarProxima(0);
  }

  private mostrarResumoImportacao(sucesso: number, falha: number): void {
    if (falha === 0) {
      this.mostrarSucesso(`${sucesso} gasto(s) importado(s) com sucesso!`);
    } else {
      this.snackBar.open(
        `${sucesso} gasto(s) importado(s) com sucesso, ${falha} falharam.`,
        'Fechar',
        { duration: 6000 }
      );
    }
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
