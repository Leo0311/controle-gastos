import { Injectable, inject } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { ComponentType } from '@angular/cdk/portal';
import { MatDialog } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { firstValueFrom, Observable } from 'rxjs';

import { Gasto } from '../../../models/gasto.model';
import { Categoria, Subcategoria } from '../../../models/categoria.model';
import { Orcamento } from '../../../models/orcamento.model';
import { GastoService } from '../../../services/gasto.service';
import { CategoriaService } from '../../../services/categoria.service';
import { OrcamentoService } from '../../../services/orcamento.service';
import { NotificacaoService } from '../../../core/notificacao.service';
import { LinhaImportacao, lerPlanilhaGastos } from '../../../core/xlsx-importer';
import { ConfirmDialogComponent, ConfirmDialogData } from '../../../shared/confirm-dialog/confirm-dialog.component';
import { classificarLinhas } from './classificar-linhas';
import {
  ImportarRevisaoDialogComponent,
  ImportarRevisaoDialogData
} from '../importar-revisao-dialog/importar-revisao-dialog.component';
import {
  ImportarAtualizacaoDialogComponent,
  ImportarAtualizacaoDialogData,
  DecisaoAtualizacao
} from '../importar-atualizacao-dialog/importar-atualizacao-dialog.component';
import {
  ImportarVinculoOrcamentoDialogComponent,
  ImportarVinculoOrcamentoDialogData,
  VinculoImportacao,
  DecisaoVinculo
} from '../importar-vinculo-orcamento-dialog/importar-vinculo-orcamento-dialog.component';
import { ImportarProgressoDialogComponent } from '../importar-progresso-dialog/importar-progresso-dialog.component';

/**
 * Orquestra a importação de gastos por planilha (achado C2 da auditoria
 * 2026-09-05): antes eram ~14 métodos privados no GastosComponent encadeados por
 * `afterClosed().subscribe(...)` aninhado. A lógica de decisão de cada linha
 * (novo/suspeita/edição/atualização) fica em `classificar-linhas.ts`, testável
 * sozinha; aqui vive só a orquestração interativa (diálogos, loops de request,
 * avisos). O componente chama `importarDeArquivo` e, no sucesso, atualiza o mapa
 * de categorias com `categoriasAtualizadas` e recarrega a lista.
 *
 * Todas as mensagens ao usuário (avisos de linhas ignoradas, resumos, "já
 * cadastrado") são responsabilidade daqui - o componente não mostra nenhuma.
 */
export interface ResultadoImportacao {
  /** 'cancelado' = fechou a revisão; 'erro' = falha que abortou (já avisada aqui). */
  status: 'ok' | 'cancelado' | 'erro';
  /** Lista visível de categorias após a importação (pode ter criado algumas). */
  categoriasAtualizadas: Categoria[];
}

type CategoriaResolvida = { categoriaId: number; subcategoriaId: number | null };

interface ResolucaoCategorias {
  categorias: Categoria[];
  subcategorias: Subcategoria[];
  resolvidas: Map<string, CategoriaResolvida>;
}

function chaveCategoria(categoria: string, subcategoria: string | null): string {
  return `${categoria.trim().toLowerCase()}|${(subcategoria ?? '').trim().toLowerCase()}`;
}

@Injectable({ providedIn: 'root' })
export class ImportacaoGastosOrquestrador {

  private readonly dialog = inject(MatDialog);
  private readonly gastoService = inject(GastoService);
  private readonly categoriaService = inject(CategoriaService);
  private readonly orcamentoService = inject(OrcamentoService);
  private readonly notificacao = inject(NotificacaoService);
  private readonly snackBar = inject(MatSnackBar);

  async importarDeArquivo(arquivo: File): Promise<ResultadoImportacao> {
    let linhas: LinhaImportacao[];
    try {
      linhas = await lerPlanilhaGastos(arquivo);
    } catch {
      this.notificacao.erro('Não foi possível ler o arquivo. Verifique se é uma planilha .xlsx válida.');
      return { status: 'erro', categoriasAtualizadas: [] };
    }
    if (linhas.length === 0) {
      this.notificacao.erro('A planilha não tem nenhuma linha de dados para importar.');
      return { status: 'erro', categoriasAtualizadas: [] };
    }

    const confirmadas = await this.abrir<
      ImportarRevisaoDialogComponent, ImportarRevisaoDialogData, LinhaImportacao[]
    >(ImportarRevisaoDialogComponent, { linhas }, '760px');
    if (!confirmadas || confirmadas.length === 0) {
      return { status: 'cancelado', categoriasAtualizadas: [] };
    }

    let resolucao: ResolucaoCategorias;
    try {
      resolucao = await this.resolverCategorias(confirmadas);
    } catch {
      this.notificacao.erro('Não foi possível preparar as categorias desta planilha para importação.');
      return { status: 'erro', categoriasAtualizadas: [] };
    }

    let gastosAtuais: Gasto[] = [];
    try {
      gastosAtuais = await firstValueFrom(this.gastoService.listarTodos());
    } catch {
      // Sem o histórico não dá pra classificar - trata tudo como linha nova
      // (mesmo efeito do fluxo antigo quando o listarTodos falhava).
    }
    const classificacao = classificarLinhas(confirmadas, gastosAtuais);

    // Linhas com ID cujo update o usuário não marcou entram na conta de "já
    // cadastrado / nada a atualizar", igual ao fluxo antigo.
    let jaCadastrados = classificacao.jaCadastradas;

    if (classificacao.atualizacoes.length > 0) {
      const decisoes = await this.abrir<
        ImportarAtualizacaoDialogComponent, ImportarAtualizacaoDialogData, DecisaoAtualizacao[]
      >(ImportarAtualizacaoDialogComponent, { atualizacoes: classificacao.atualizacoes }, '820px');
      const decididas = decisoes ?? [];
      jaCadastrados += classificacao.atualizacoes.length - decididas.length;
      await this.processarAtualizacoes(decididas, resolucao.resolvidas);
    }

    let novas = [...classificacao.linhasNovas];
    novas = await this.confirmarGrupo(
      novas, classificacao.linhasSuspeitas,
      {
        titulo: 'ID não encontrado',
        mensagem: 'linha(s) desta planilha têm um ID que não corresponde a nenhum gasto seu atual (o gasto '
          + 'pode já ter sido excluído, ou esta planilha é de uma exportação antiga). Os dados dessas linhas '
          + 'são diferentes de tudo que você já tem cadastrado, então não são uma duplicata - mas, por causa '
          + 'do ID estranho, prefira conferir antes de confirmar. Deseja importar estas linhas como gastos '
          + 'novos mesmo assim?'
      },
      'linha(s) com ID não encontrado foram ignoradas (não importadas).'
    );
    novas = await this.confirmarGrupo(
      novas, classificacao.linhasPossivelEdicao,
      {
        titulo: 'Isto parece uma edição, não um gasto novo',
        mensagem: 'linha(s) têm a mesma descrição e categoria de um gasto já cadastrado, mas com valor ou '
          + 'data diferentes - parece que você editou um gasto existente. Só que esta planilha não tem a '
          + 'coluna ID, então não é possível ter certeza de qual gasto é (nem atualizá-lo automaticamente): '
          + 'se confirmar, um gasto NOVO será criado, e o antigo continuará como estava, duplicado. Para '
          + 'atualizar de verdade um gasto existente, cancele agora, clique em "Exportar XLSX" para gerar um '
          + 'arquivo com a coluna ID, edite esse arquivo (não o modelo de importação) e reimporte-o. Deseja '
          + 'criar estas linhas como gastos novos mesmo assim?'
      },
      'linha(s) que pareciam edições foram ignoradas (não importadas).'
    );

    if (jaCadastrados > 0) {
      this.snackBar.open(
        jaCadastrados === 1
          ? 'Este dado já está cadastrado. Como não houve edição, nada foi atualizado.'
          : `${jaCadastrados} dado(s) desta planilha já estão cadastrados. Como não houve edição, nada foi atualizado.`,
        'Fechar',
        { duration: 5000 }
      );
    }

    if (novas.length > 0) {
      const vinculos = await this.decidirVinculosOrcamento(novas, resolucao.resolvidas);
      await this.processarCriacao(novas, resolucao.resolvidas, vinculos);
    }

    return { status: 'ok', categoriasAtualizadas: resolucao.categorias };
  }

  // Cada categoria/subcategoria em texto puro da planilha vira uma gerenciada de
  // verdade - criando uma privada nova quando não bate (sem diferenciar
  // maiúsculas) com nenhuma visível, igual à migração feita no banco.
  private async resolverCategorias(linhas: LinhaImportacao[]): Promise<ResolucaoCategorias> {
    let categorias = await firstValueFrom(this.categoriaService.listarVisiveis());
    let subcategorias = await firstValueFrom(this.categoriaService.listarTodasSubcategorias());
    const resolvidas = new Map<string, CategoriaResolvida>();

    for (const linha of linhas) {
      const chave = chaveCategoria(linha.categoria, linha.subcategoria);
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

    return { categorias, subcategorias, resolvidas };
  }

  // Diálogo de confirmação de um grupo (suspeitas / possíveis edições): se
  // confirmar, o grupo é anexado às linhas novas; se não, some com um aviso.
  private async confirmarGrupo(
    novas: LinhaImportacao[],
    grupo: LinhaImportacao[],
    texto: { titulo: string; mensagem: string },
    avisoIgnoradas: string
  ): Promise<LinhaImportacao[]> {
    if (grupo.length === 0) {
      return novas;
    }
    const confirmado = await this.abrir<ConfirmDialogComponent, ConfirmDialogData, boolean>(
      ConfirmDialogComponent,
      { titulo: texto.titulo, mensagem: `${grupo.length} ${texto.mensagem}` },
      undefined
    );
    if (confirmado) {
      return [...novas, ...grupo];
    }
    this.notificacao.erro(`${grupo.length} ${avisoIgnoradas}`);
    return novas;
  }

  private async decidirVinculosOrcamento(
    linhas: LinhaImportacao[],
    resolvidas: Map<string, CategoriaResolvida>
  ): Promise<Map<number, number>> {
    let orcamentos: Orcamento[];
    try {
      orcamentos = await firstValueFrom(this.orcamentoService.listarTodos());
    } catch {
      return new Map();
    }

    const vinculos = this.encontrarVinculosPossiveis(linhas, orcamentos, resolvidas);
    if (vinculos.length === 0) {
      return new Map();
    }

    const decisoes = await this.abrir<
      ImportarVinculoOrcamentoDialogComponent, ImportarVinculoOrcamentoDialogData, DecisaoVinculo[]
    >(ImportarVinculoOrcamentoDialogComponent, { vinculos }, '760px');
    return new Map((decisoes ?? []).map((d) => [d.linhaNumero, d.orcamentoId]));
  }

  private encontrarVinculosPossiveis(
    linhas: LinhaImportacao[],
    orcamentos: Orcamento[],
    resolvidas: Map<string, CategoriaResolvida>
  ): VinculoImportacao[] {
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
      // Prioriza o orçamento específico da subcategoria da linha; só cai para o
      // geral da categoria (sem subcategoria) se não houver um específico.
      const resolvida = resolvidas.get(chaveCategoria(linha.categoria, linha.subcategoria));
      const especifico = resolvida?.subcategoriaId
        ? opcoes.find((o) => o.categoriaId === resolvida.categoriaId && o.subcategoriaId === resolvida.subcategoriaId)
        : undefined;
      const geral = opcoes.find((o) => o.categoriaId === resolvida?.categoriaId && !o.subcategoriaId);
      vinculos.push({ linha, opcoes, orcamentoId: (especifico ?? geral)?.id ?? null });
    }
    return vinculos;
  }

  private async processarAtualizacoes(
    decisoes: DecisaoAtualizacao[],
    resolvidas: Map<string, CategoriaResolvida>
  ): Promise<void> {
    if (decisoes.length === 0) {
      return;
    }
    const { sucesso, falha } = await this.processarEmLote(decisoes, (d) =>
      this.gastoService.atualizar(
        d.existente.id!,
        this.montarGasto(d.linha, resolvidas, d.existente.orcamentoId ?? null)
      ));
    this.mostrarResumo(sucesso, falha, 'atualizado(s)');
  }

  private async processarCriacao(
    linhas: LinhaImportacao[],
    resolvidas: Map<string, CategoriaResolvida>,
    vinculos: Map<number, number>
  ): Promise<void> {
    // deduplicar: true - o backend recusa com 409 uma linha idêntica a um gasto já
    // cadastrado (achado M6). Acontece só quando a detecção do cliente não pôde
    // rodar (ex.: listarTodos falhou acima e classificou tudo como novo); nesse
    // caso a linha é contada como já cadastrada, não como falha.
    const { sucesso, falha, ignorados } = await this.processarEmLote(
      linhas,
      (linha) => this.gastoService.cadastrar(
        this.montarGasto(linha, resolvidas, vinculos.get(linha.linha) ?? null),
        { deduplicar: true }
      ),
      (erro) => erro instanceof HttpErrorResponse && erro.status === 409
    );

    if (ignorados > 0) {
      // Uma mensagem só, com sucesso + ignoradas + falhas: dois snackbars seguidos
      // se encobrem (o segundo fecha o primeiro na hora), e "0 importados" isolado
      // não faz sentido quando a planilha inteira já estava cadastrada.
      const partes: string[] = [];
      if (sucesso > 0) {
        partes.push(`${sucesso} gasto(s) importado(s)`);
      }
      partes.push(`${ignorados} linha(s) desta planilha já estavam cadastradas e foram ignoradas`);
      if (falha > 0) {
        partes.push(`${falha} falharam`);
      }
      this.snackBar.open(`${partes.join('. ')}.`, 'Fechar', { duration: 6000 });
      return;
    }

    this.mostrarResumo(sucesso, falha, 'importado(s)');
  }

  // Loop sequencial (um request por vez - o rate limit do backend é calibrado
  // pra isso) com o diálogo de progresso. `ehIgnoravel` separa os erros que não
  // são falha de verdade (ex.: 409 de duplicata na criação) numa terceira conta.
  private async processarEmLote<T>(
    itens: T[],
    acao: (item: T) => Observable<unknown>,
    ehIgnoravel?: (erro: unknown) => boolean
  ): Promise<{ sucesso: number; falha: number; ignorados: number }> {
    const ref = this.dialog.open(ImportarProgressoDialogComponent, {
      disableClose: true, width: '360px', maxWidth: '95vw'
    });
    ref.componentInstance.total = itens.length;
    ref.componentInstance.atual = 0;

    let sucesso = 0;
    let falha = 0;
    let ignorados = 0;
    for (let i = 0; i < itens.length; i++) {
      try {
        await firstValueFrom(acao(itens[i]));
        sucesso++;
      } catch (erro) {
        if (ehIgnoravel?.(erro)) {
          ignorados++;
        } else {
          falha++;
        }
      }
      ref.componentInstance.atual = i + 1;
    }

    ref.close();
    return { sucesso, falha, ignorados };
  }

  private montarGasto(
    linha: LinhaImportacao,
    resolvidas: Map<string, CategoriaResolvida>,
    orcamentoId: number | null
  ): Gasto {
    const resolvida = resolvidas.get(chaveCategoria(linha.categoria, linha.subcategoria));
    return {
      descricao: linha.descricao,
      valor: linha.valor!,
      categoriaId: resolvida!.categoriaId,
      subcategoriaId: resolvida!.subcategoriaId,
      data: linha.data!,
      orcamentoId
    };
  }

  private mostrarResumo(sucesso: number, falha: number, verbo: string): void {
    if (falha === 0) {
      this.notificacao.sucesso(`${sucesso} gasto(s) ${verbo} com sucesso!`);
    } else {
      this.snackBar.open(
        `${sucesso} gasto(s) ${verbo} com sucesso, ${falha} falharam.`,
        'Fechar',
        { duration: 6000 }
      );
    }
  }

  private abrir<C, D, R>(componente: ComponentType<C>, data: D, width?: string): Promise<R | undefined> {
    const config = width ? { data, width, maxWidth: '95vw' } : { data };
    const ref = this.dialog.open<C, D, R>(componente, config);
    return firstValueFrom(ref.afterClosed(), { defaultValue: undefined });
  }
}
