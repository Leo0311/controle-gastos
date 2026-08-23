import { Component, ElementRef, OnInit, ViewChild } from '@angular/core';
import { CurrencyPipe, DatePipe } from '@angular/common';
import { MatTableModule } from '@angular/material/table';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatMenuModule } from '@angular/material/menu';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';

import { GastoService } from '../../../services/gasto.service';
import { OrcamentoService } from '../../../services/orcamento.service';
import { Gasto } from '../../../models/gasto.model';
import { Orcamento } from '../../../models/orcamento.model';
import { GastoFormDialogComponent, GastoFormDialogData } from '../gasto-form-dialog/gasto-form-dialog.component';
import { ConfirmDialogComponent, ConfirmDialogData } from '../../../shared/confirm-dialog/confirm-dialog.component';
import { EmptyStateComponent } from '../../../shared/empty-state/empty-state.component';
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

@Component({
  selector: 'app-gastos',
  standalone: true,
  imports: [
    CurrencyPipe,
    DatePipe,
    MatTableModule,
    MatButtonModule,
    MatIconModule,
    MatDialogModule,
    MatMenuModule,
    MatSnackBarModule,
    MatProgressSpinnerModule,
    EmptyStateComponent
  ],
  templateUrl: './gastos.component.html',
  styleUrl: './gastos.component.css'
})
export class GastosComponent implements OnInit {

  @ViewChild('inputArquivo') inputArquivo!: ElementRef<HTMLInputElement>;

  readonly colunas = ['id', 'descricao', 'valor', 'categoria', 'data', 'acoes'];
  gastos: Gasto[] = [];
  carregando = false;

  constructor(
    private readonly gastoService: GastoService,
    private readonly orcamentoService: OrcamentoService,
    private readonly dialog: MatDialog,
    private readonly snackBar: MatSnackBar
  ) { }

  ngOnInit(): void {
    this.carregar();
  }

  carregar(): void {
    this.carregando = true;
    this.gastoService.listarTodos().subscribe({
      next: (gastos) => {
        this.gastos = gastos;
        this.carregando = false;
      },
      error: () => {
        this.carregando = false;
        this.mostrarErro('Não foi possível carregar os gastos. Verifique se a API está no ar.');
      }
    });
  }

  novoGasto(): void {
    const ref = this.dialog.open<GastoFormDialogComponent, GastoFormDialogData, Gasto>(GastoFormDialogComponent, {
      data: { gasto: null }
    });

    ref.afterClosed().subscribe((resultado) => {
      if (!resultado) {
        return;
      }
      this.gastoService.cadastrar(resultado).subscribe({
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
    const ref = this.dialog.open<GastoFormDialogComponent, GastoFormDialogData, Gasto>(GastoFormDialogComponent, {
      data: { gasto }
    });

    ref.afterClosed().subscribe((resultado) => {
      if (!resultado) {
        return;
      }
      this.gastoService.atualizar(gasto.id!, resultado).subscribe({
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

    let linhas: LinhaImportacao[];
    try {
      linhas = await lerPlanilhaGastos(arquivo);
    } catch {
      this.mostrarErro('Não foi possível ler o arquivo. Verifique se é uma planilha .xlsx válida.');
      return;
    }

    if (linhas.length === 0) {
      this.mostrarErro('A planilha não tem nenhuma linha de dados para importar.');
      return;
    }

    const ref = this.dialog.open<ImportarRevisaoDialogComponent, ImportarRevisaoDialogData, LinhaImportacao[]>(
      ImportarRevisaoDialogComponent,
      { data: { linhas }, width: '760px', maxWidth: '95vw' }
    );

    ref.afterClosed().subscribe((linhasConfirmadas) => {
      if (!linhasConfirmadas || linhasConfirmadas.length === 0) {
        return;
      }
      this.prepararAtualizacao(linhasConfirmadas);
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
            && g.categoria.trim().toLowerCase() === linha.categoria.trim().toLowerCase()
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
      || existente.categoria.toLowerCase() !== linha.categoria.toLowerCase()
      || existente.data !== linha.data;
  }

  private executarAtualizacoes(decisoes: DecisaoAtualizacao[], aposConcluir: () => void): void {
    if (decisoes.length === 0) {
      aposConcluir();
      return;
    }

    const progressoRef = this.dialog.open(ImportarProgressoDialogComponent, {
      disableClose: true,
      width: '360px'
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
      const gasto: Gasto = {
        descricao: decisao.linha.descricao,
        valor: decisao.linha.valor!,
        categoria: decisao.linha.categoria,
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
        .sort((a, b) => a.categoria.localeCompare(b.categoria));
      if (opcoes.length === 0) {
        continue;
      }
      const correspondente = opcoes.find((o) => o.categoria.toLowerCase() === linha.categoria.toLowerCase());
      vinculos.push({ linha, opcoes, orcamentoId: correspondente?.id ?? null });
    }
    return vinculos;
  }

  private executarImportacao(linhas: LinhaImportacao[], vinculos?: Map<number, number>): void {
    const progressoRef = this.dialog.open(ImportarProgressoDialogComponent, {
      disableClose: true,
      width: '360px'
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
      const gasto: Gasto = {
        descricao: linha.descricao,
        valor: linha.valor!,
        categoria: linha.categoria,
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
