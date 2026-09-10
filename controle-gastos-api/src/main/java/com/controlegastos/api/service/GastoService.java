package com.controlegastos.api.service;

import com.controlegastos.api.dto.CategoriaTotalDTO;
import com.controlegastos.api.dto.ComparacaoCategoriaDTO;
import com.controlegastos.api.dto.ComparacaoMensalDTO;
import com.controlegastos.api.dto.GastoPaginaDTO;
import com.controlegastos.api.dto.RankingCategoriaDTO;
import com.controlegastos.api.dto.RankingCategoriasDTO;
import com.controlegastos.api.dto.RankingSubcategoriaDTO;
import com.controlegastos.api.dto.ResumoDTO;
import com.controlegastos.api.dto.StatusPorFonteDTO;
import com.controlegastos.api.dto.TotalDiarioDTO;
import com.controlegastos.api.dto.TotalMensalDTO;
import com.controlegastos.api.exception.GastoDuplicadoException;
import com.controlegastos.api.exception.OrcamentoInvalidoException;
import com.controlegastos.api.exception.RecursoNaoEncontradoException;
import com.controlegastos.api.model.Categoria;
import com.controlegastos.api.model.Gasto;
import com.controlegastos.api.model.GastoRecorrente;
import com.controlegastos.api.model.StatusPagamento;
import com.controlegastos.api.model.Subcategoria;
import com.controlegastos.api.repository.CategoriaRepository;
import com.controlegastos.api.repository.GastoRecorrenteRepository;
import com.controlegastos.api.repository.GastoRepository;
import com.controlegastos.api.repository.OrcamentoRepository;
import com.controlegastos.api.repository.SubcategoriaRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.time.YearMonth;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class GastoService {

    private static final int PAGINA_TAMANHO_PADRAO = 50;
    private static final int PAGINA_TAMANHO_MAXIMO = 200;

    private final GastoRepository repository;
    private final OrcamentoRepository orcamentoRepository;
    private final CategoriaRepository categoriaRepository;
    private final SubcategoriaRepository subcategoriaRepository;
    private final GastoRecorrenteRepository gastoRecorrenteRepository;

    // validar() é compartilhado por TODO gasto que chega no banco - avulso
    // (cadastrar), vinculado a recorrência (cadastrarVinculadoARecorrente) e cada
    // parcela de uma compra parcelada (salvarParcelas chama validar por parcela).
    // Por isso a janela aqui não pode ser a mesma (12 meses passado / 2 futuro) de
    // CompraParceladaService.validar: aquela vale só pra DATA DA 1ª PARCELA: com até
    // 120 parcelas mensais a partir dela, a ÚLTIMA parcela de uma compra parcelada
    // legítima pode cair até ~121 meses (~10 anos) no futuro. Esta janela só existe
    // pra pegar erro de digitação grosseiro (ano 999999999 quebrando o tipo DATE do
    // Postgres) - auditoria 2026-09, achado R1 - sem barrar nem parcela longa nem
    // registro de dívida antiga (histórico legado permitido de propósito).
    private static final int GASTO_ANOS_PASSADO_MAXIMO = 100;
    private static final int GASTO_ANOS_FUTURO_MAXIMO = 15;

    public List<Gasto> listarTodos(Integer usuarioId) {
        return repository.findAllByUsuarioIdOrderByDataDescIdDesc(usuarioId);
    }

    // Listagem paginada da tela de Gastos (achado C1 da auditoria 2026-09-05).
    // mes/ano/categoriaId são filtros opcionais - a tela passa só o que estiver
    // ativo. A janela de datas é derivada aqui (mês -> 1º/último dia; só ano -> jan
    // a dez; nenhum -> todo o histórico), pra o repositório receber só inicio/fim.
    // Ordenação (data desc, id desc) montada aqui, nunca vinda do cliente.
    public GastoPaginaDTO listarPaginado(
            Integer usuarioId, Integer mes, Integer ano, Integer categoriaId, int pagina, int tamanho) {
        LocalDate inicio = null;
        LocalDate fim = null;
        if (ano != null) {
            if (ano <= 0) {
                throw new IllegalArgumentException("Ano inválido.");
            }
            if (mes != null) {
                validarMesAno(mes, ano);
                inicio = LocalDate.of(ano, mes, 1);
                fim = inicio.withDayOfMonth(inicio.lengthOfMonth());
            } else {
                inicio = LocalDate.of(ano, 1, 1);
                fim = LocalDate.of(ano, 12, 31);
            }
        }

        int paginaSegura = Math.max(pagina, 0);
        int tamanhoSeguro = tamanho < 1 ? PAGINA_TAMANHO_PADRAO : Math.min(tamanho, PAGINA_TAMANHO_MAXIMO);
        Pageable pageable = PageRequest.of(paginaSegura, tamanhoSeguro,
                Sort.by(Sort.Order.desc("data"), Sort.Order.desc("id")));

        Page<Gasto> resultado = repository.buscarPagina(usuarioId, categoriaId, inicio, fim, pageable);
        return new GastoPaginaDTO(
                resultado.getContent(), resultado.getNumber(), resultado.getTotalPages(),
                resultado.getTotalElements(), resultado.isLast());
    }

    public Gasto buscarPorId(Integer id, Integer usuarioId) {
        return repository.findByIdAndUsuarioId(id, usuarioId)
                .orElseThrow(() -> new RecursoNaoEncontradoException("Gasto não encontrado com ID " + id));
    }

    public List<Gasto> listarPorCategoria(String categoria, Integer usuarioId) {
        return repository.findByUsuarioIdAndCategoriaIgnoreCaseOrderByDataDescIdDesc(usuarioId, categoria);
    }

    public List<Gasto> listarPorPeriodo(LocalDate inicio, LocalDate fim, Integer usuarioId) {
        return repository.findByUsuarioIdAndDataBetweenOrderByDataDescIdDesc(usuarioId, inicio, fim);
    }

    public Gasto cadastrar(Gasto gasto, Integer usuarioId) {
        return cadastrar(gasto, usuarioId, false);
    }

    // rejeitarDuplicata=true só é usado pela importação de planilha (POST
    // /api/gastos?deduplicar=true): se já existe um gasto logicamente idêntico
    // (mesma descrição, valor e data - ver GastoRepository.existeGastoEquivalente),
    // a linha é recusada com 409 em vez de criar uma cópia. É a rede de segurança
    // do achado M6 - a detecção "de verdade" continua no frontend, com a UX de
    // revisão; aqui é só o corte final pro caso de ela não ter rodado. O cadastro
    // manual avulso (rejeitarDuplicata=false) segue permitindo dois gastos iguais
    // no mesmo dia de propósito.
    public Gasto cadastrar(Gasto gasto, Integer usuarioId, boolean rejeitarDuplicata) {
        // gastoRecorrenteId/compraParceladaId só podem ser setados internamente por
        // GastoRecorrenteService/CompraParceladaService (ver cadastrarVinculadoA*) -
        // nunca por uma criação vinda da API pública, senão qualquer cliente poderia
        // marcar um gasto como "gerado automaticamente".
        gasto.setGastoRecorrenteId(null);
        gasto.setCompraParceladaId(null);
        // Gasto avulso não tem conceito de vencimento: nasce PAGO com a própria
        // data informada. O cliente nunca injeta status (o campo é do servidor);
        // dataPagamento é preenchida em salvar(), depois do default de data.
        gasto.setStatusPagamento(StatusPagamento.PAGO);
        gasto.setVencimentoOriginal(null);
        gasto.setDataPagamento(null);
        if (rejeitarDuplicata) {
            rejeitarSeDuplicata(gasto, usuarioId);
        }
        return salvar(gasto, usuarioId);
    }

    private void rejeitarSeDuplicata(Gasto gasto, Integer usuarioId) {
        // Campos incompletos (descrição/valor nulos) são erro de validação, não
        // duplicata - deixa validar() em salvar() reportar com a mensagem certa.
        if (gasto.getDescricao() == null || gasto.getValor() == null) {
            return;
        }
        LocalDate data = gasto.getData() != null ? gasto.getData() : LocalDate.now();
        if (repository.existeGastoEquivalente(usuarioId, data, gasto.getValor(), gasto.getDescricao())) {
            throw new GastoDuplicadoException(
                    "Já existe um gasto idêntico (mesma descrição, valor e data) cadastrado.");
        }
    }

    // Usado só por GastoRecorrenteService pra criar o gasto já vinculado à recorrência
    // de origem (gasto.gastoRecorrenteId) - nunca exposto diretamente via endpoint público.
    public Gasto cadastrarVinculadoARecorrente(Gasto gasto, Integer usuarioId) {
        return salvar(gasto, usuarioId);
    }

    // Persiste em lote as parcelas de uma compra parcelada. Categoria, subcategoria
    // (nomes já preenchidos em cada Gasto) e orçamento foram resolvidos e validados
    // UMA única vez pelo chamador (CompraParceladaService.cadastrar), então aqui NÃO
    // se repete a resolução por parcela - antes era 1 findByIdVisivel de categoria (+
    // 1 de subcategoria, + 1 de orçamento) para cada uma das N parcelas. A validação
    // dos campos básicos roda para TODAS as parcelas antes de qualquer escrita, pra
    // uma parcela inválida não deixar meia compra gravada. Nunca exposto via endpoint.
    public List<Gasto> salvarParcelas(List<Gasto> parcelas, Integer usuarioId) {
        parcelas.forEach(this::validar);
        List<Gasto> salvos = new ArrayList<>(parcelas.size());
        for (Gasto parcela : parcelas) {
            parcela.setId(null);
            parcela.setUsuarioId(usuarioId);
            if (parcela.getData() == null) {
                parcela.setData(LocalDate.now());
            }
            salvos.add(repository.save(parcela));
        }
        return salvos;
    }

    private Gasto salvar(Gasto gasto, Integer usuarioId) {
        validar(gasto);
        resolverCategoria(gasto, usuarioId);
        validarOrcamento(gasto.getOrcamentoId(), usuarioId);
        gasto.setId(null);
        gasto.setUsuarioId(usuarioId);
        if (gasto.getData() == null) {
            gasto.setData(LocalDate.now());
        }
        aplicarStatusPadrao(gasto);
        return repository.save(gasto);
    }

    // Fallback de status pra qualquer gasto que chega em salvar() sem ele definido
    // (só o fluxo avulso passa por aqui hoje - a recorrência monta o Gasto já com
    // PENDENTE + vencimento). PAGO sem data de pagamento assume a própria data.
    private void aplicarStatusPadrao(Gasto gasto) {
        if (gasto.getStatusPagamento() == null) {
            gasto.setStatusPagamento(StatusPagamento.PAGO);
        }
        if (gasto.getStatusPagamento() == StatusPagamento.PAGO && gasto.getDataPagamento() == null) {
            gasto.setDataPagamento(gasto.getData());
        }
    }

    public Gasto atualizar(Integer id, Gasto dados, Integer usuarioId) {
        Gasto existente = buscarPorId(id, usuarioId);
        validar(dados);
        resolverCategoria(dados, usuarioId);
        validarOrcamento(dados.getOrcamentoId(), usuarioId);
        // Parcela de compra parcelada: descrição, valor e data são definidos pela
        // compra e não podem mudar aqui (quebrariam o "(k/N)", a soma das parcelas
        // ou a sequência de meses). O frontend já trava esses campos; isto garante
        // o mesmo por chamada direta à API. Categoria/subcategoria/orçamento seguem
        // editáveis (recategorizar ou revincular a orçamento não quebra o parcelamento).
        if (existente.getCompraParceladaId() == null) {
            existente.setDescricao(dados.getDescricao());
            existente.setValor(dados.getValor());
            existente.setData(dados.getData() != null ? dados.getData() : existente.getData());
            sincronizarPagamentoComEdicaoManual(existente);
        }
        existente.setCategoria(dados.getCategoria());
        existente.setSubcategoria(dados.getSubcategoria());
        existente.setCategoriaId(dados.getCategoriaId());
        existente.setSubcategoriaId(dados.getSubcategoriaId());
        existente.setOrcamentoId(dados.getOrcamentoId());
        return repository.save(existente);
    }

    // A edição manual de descrição/valor/data de um gasto (feita pelo formulário de
    // gasto, não pelo fluxo de "marcar como paga") reflete nos campos de pagamento
    // conforme a natureza do gasto:
    //  - avulso: continua PAGO, data de pagamento acompanha a data;
    //  - recorrência ainda PENDENTE: a nova data passa a ser o vencimento;
    //  - recorrência já PAGA: a nova data é a data real do pagamento (vencimento
    //    original preservado).
    private void sincronizarPagamentoComEdicaoManual(Gasto gasto) {
        if (gasto.getGastoRecorrenteId() == null) {
            gasto.setDataPagamento(gasto.getData());
        } else if (gasto.getStatusPagamento() == StatusPagamento.PENDENTE) {
            gasto.setVencimentoOriginal(gasto.getData());
        } else {
            gasto.setDataPagamento(gasto.getData());
        }
    }

    // Confirma o pagamento de um gasto de recorrência/parcela: valor (pré-preenchido
    // no frontend com o previsto, mas editável) e data (padrão hoje, editável). A
    // data do gasto passa a ser a data real do pagamento - isso pode mover o gasto
    // de mês nos totais/Dashboard/Análises/Orçamentos (regime de caixa, comportamento
    // desejado); o vencimento original fica preservado à parte pra permitir desfazer.
    // Serve também pra EDITAR um pagamento já feito (só re-seta valor/data).
    public Gasto pagar(Integer id, BigDecimal valor, LocalDate data, Integer usuarioId) {
        Gasto gasto = buscarPorId(id, usuarioId);
        if (gasto.getGastoRecorrenteId() == null && gasto.getCompraParceladaId() == null) {
            throw new IllegalArgumentException(
                    "Gasto avulso já é considerado pago - não há pagamento a confirmar.");
        }
        if (valor == null || valor.compareTo(BigDecimal.ZERO) <= 0) {
            throw new IllegalArgumentException("Valor deve ser maior que zero.");
        }
        LocalDate dataPagamento = data != null ? data : LocalDate.now();
        validarData(dataPagamento);
        // Só na 1ª confirmação: o gasto PENDENTE está datado no vencimento, então
        // guarda-se essa data antes de sobrescrever com a data real. Numa edição de
        // pagamento já feito, vencimentoOriginal já está preenchido e não muda.
        if (gasto.getVencimentoOriginal() == null) {
            gasto.setVencimentoOriginal(gasto.getData());
        }
        gasto.setValor(valor);
        gasto.setData(dataPagamento);
        gasto.setDataPagamento(dataPagamento);
        gasto.setStatusPagamento(StatusPagamento.PAGO);
        return repository.save(gasto);
    }

    // Desfaz o pagamento: status volta a PENDENTE e a data do gasto volta a ser o
    // vencimento original (o gasto volta pro mês do vencimento nos totais). O valor
    // fica como estava - se foi editado na confirmação, continua editado.
    public Gasto desfazerPagamento(Integer id, Integer usuarioId) {
        Gasto gasto = buscarPorId(id, usuarioId);
        if (gasto.getGastoRecorrenteId() == null && gasto.getCompraParceladaId() == null) {
            throw new IllegalArgumentException("Gasto avulso não tem pagamento a desfazer.");
        }
        if (gasto.getStatusPagamento() != StatusPagamento.PAGO || gasto.getVencimentoOriginal() == null) {
            throw new IllegalArgumentException(
                    "Este gasto não está pago ou não tem vencimento original para restaurar.");
        }
        gasto.setData(gasto.getVencimentoOriginal());
        gasto.setStatusPagamento(StatusPagamento.PENDENTE);
        gasto.setDataPagamento(null);
        return repository.save(gasto);
    }

    // Contas atrasadas do usuário: PENDENTE com vencimento no passado, qualquer mês.
    // Usado no destaque de atrasadas do Dashboard.
    public List<Gasto> atrasadas(Integer usuarioId) {
        return repository.atrasadas(usuarioId, LocalDate.now());
    }

    // Contas que vencem hoje: PENDENTE com vencimento_original = hoje. Destaque
    // âmbar do Dashboard, irmão de atrasadas().
    public List<Gasto> venceHoje(Integer usuarioId) {
        return repository.venceHoje(usuarioId, LocalDate.now());
    }

    // Menor e maior janela aceitas pela aba "Próximas contas" (seletor 1/3/6/12).
    private static final int PROXIMAS_CONTAS_MESES_MIN = 1;
    private static final int PROXIMAS_CONTAS_MESES_MAX = 12;

    // Agenda da aba "Próximas contas": ocorrências de recorrência/parcela ainda não
    // pagas até o fim do mês que está a `meses` meses de distância - mais TODAS as
    // atrasadas, independente de `meses` (o teto único da query já cobre, porque
    // atrasada é vencimento < hoje <= fimHorizonte). Substitui o antigo
    // GET /api/gastos (histórico inteiro) que a tela baixava só pra filtrar no cliente.
    public List<Gasto> proximasContas(Integer usuarioId, int meses) {
        if (meses < PROXIMAS_CONTAS_MESES_MIN || meses > PROXIMAS_CONTAS_MESES_MAX) {
            throw new IllegalArgumentException(
                    "O parâmetro 'meses' deve estar entre " + PROXIMAS_CONTAS_MESES_MIN
                    + " e " + PROXIMAS_CONTAS_MESES_MAX + ".");
        }
        LocalDate fimHorizonte = YearMonth.now().plusMonths(meses).atEndOfMonth();
        return repository.agendaProximasContas(usuarioId, fimHorizonte);
    }

    // Contadores por recorrência e por compra parcelada (pendentes / atrasadas /
    // lançamentos futuros), cada conjunto numa query agregada. Alimenta os badges
    // das abas Recorrentes e Parceladas e o "N lançamentos futuros" - antes o
    // cliente derivava isso da lista completa de gastos.
    public List<StatusPorFonteDTO> statusPorFonte(Integer usuarioId) {
        LocalDate hoje = LocalDate.now();
        List<StatusPorFonteDTO> resultado = new ArrayList<>();
        for (var c : repository.contarStatusPorRecorrente(usuarioId, hoje)) {
            resultado.add(new StatusPorFonteDTO(
                    "RECORRENTE", c.getFonteId(), c.getPendentes(), c.getAtrasadas(), c.getFuturos()));
        }
        for (var c : repository.contarStatusPorParcelada(usuarioId, hoje)) {
            resultado.add(new StatusPorFonteDTO(
                    "PARCELADA", c.getFonteId(), c.getPendentes(), c.getAtrasadas(), c.getFuturos()));
        }
        return resultado;
    }

    // Confirma que a categoria (e a subcategoria, se houver) escolhidas existem e são
    // visíveis para o usuário, e espelha o nome delas nas colunas de texto legadas -
    // ver comentário na entidade Gasto sobre por que essas colunas continuam existindo.
    private void resolverCategoria(Gasto gasto, Integer usuarioId) {
        Categoria categoria = categoriaRepository.findByIdVisivel(gasto.getCategoriaId(), usuarioId)
                .orElseThrow(() -> new IllegalArgumentException("Categoria inválida ou não pertence ao usuário."));
        gasto.setCategoria(categoria.getNome());

        if (gasto.getSubcategoriaId() == null) {
            gasto.setSubcategoria(null);
            return;
        }
        Subcategoria subcategoria = subcategoriaRepository.findByIdVisivel(gasto.getSubcategoriaId(), usuarioId)
                .orElseThrow(() -> new IllegalArgumentException("Subcategoria inválida ou não pertence ao usuário."));
        if (!subcategoria.getCategoriaId().equals(categoria.getId())) {
            throw new IllegalArgumentException("Subcategoria não pertence à categoria selecionada.");
        }
        gasto.setSubcategoria(subcategoria.getNome());
    }

    @Transactional
    public void excluir(Integer id, Integer usuarioId) {
        Gasto existente = buscarPorId(id, usuarioId);
        // Excluir uma parcela isolada deixaria o parcelamento permanentemente
        // incoerente (some do extrato, mas a compra continua marcada com o número
        // original de parcelas). Só a compra parcelada inteira pode ser removida -
        // via CompraParceladaService.excluir, que apaga as parcelas futuras em
        // bloco e mantém as já vencidas como histórico.
        if (existente.getCompraParceladaId() != null) {
            throw new IllegalArgumentException(
                    "Esta é uma parcela de uma compra parcelada e não pode ser excluída sozinha. "
                    + "Para desfazer, exclua a compra parcelada inteira na aba \"Parceladas\" (tela Recorrentes).");
        }
        // Excluir um lançamento gerado por uma recorrência remove a recorrência
        // INTEIRA em cascata (todos os lançamentos dela + o registro), não só este
        // gasto - o frontend confirma isso explicitamente antes de chamar. Um gasto
        // avulso (sem gastoRecorrenteId) segue sendo excluído sozinho.
        if (existente.getGastoRecorrenteId() != null) {
            excluirRecorrenciaEmCascata(existente.getGastoRecorrenteId(), usuarioId);
            return;
        }
        repository.delete(existente);
    }

    // Exclusão em cascata de uma recorrência: apaga TODOS os gastos vinculados a ela
    // (passados e futuros) e depois o próprio registro. Ponto único chamado tanto
    // pela aba Gastos (excluir um lançamento dela) quanto pela aba Recorrentes
    // (excluir o recorrente direto) - ver GastoRecorrenteService.excluir. Tudo numa
    // transação: falhou no meio, nada é removido.
    @Transactional
    public void excluirRecorrenciaEmCascata(Integer recorrenteId, Integer usuarioId) {
        GastoRecorrente recorrente = gastoRecorrenteRepository.findByIdAndUsuarioId(recorrenteId, usuarioId)
                .orElseThrow(() -> new RecursoNaoEncontradoException(
                        "Gasto recorrente não encontrado com ID " + recorrenteId));
        repository.excluirTodosDaRecorrente(recorrenteId);
        gastoRecorrenteRepository.delete(recorrente);
    }

    public ResumoDTO resumo(Integer usuarioId, LocalDate inicio, LocalDate fim) {
        BigDecimal totalGeral = repository.somarNoPeriodo(usuarioId, inicio, fim);
        List<CategoriaTotalDTO> porCategoria = repository.somarPorCategoriaNoPeriodo(usuarioId, inicio, fim).stream()
                .map(c -> new CategoriaTotalDTO(c.getCategoriaId(), c.getCategoria(), c.getTotal()))
                .collect(Collectors.toList());
        return new ResumoDTO(totalGeral, porCategoria);
    }

    public List<TotalMensalDTO> totaisMensais(int meses, Integer usuarioId) {
        List<TotalMensalDTO> resultado = new ArrayList<>();
        YearMonth atual = YearMonth.now();

        for (int i = meses - 1; i >= 0; i--) {
            YearMonth mesAno = atual.minusMonths(i);
            BigDecimal total = repository.somarNoPeriodo(usuarioId, mesAno.atDay(1), mesAno.atEndOfMonth());
            resultado.add(new TotalMensalDTO(mesAno.getMonthValue(), mesAno.getYear(), total));
        }
        return resultado;
    }

    // Total gasto em cada dia do mês/ano informado (dia 1 até o último dia do mês) -
    // usado pelo gráfico de barras "diário" do Dashboard quando "Destacar mês" está
    // ativo. Uma única consulta ao período inteiro, agregada em memória por dia, em
    // vez de uma query por dia (até 31 idas ao banco por carregamento).
    public List<TotalDiarioDTO> totaisDiarios(int mes, int ano, Integer usuarioId) {
        validarMesAno(mes, ano);
        LocalDate inicio = LocalDate.of(ano, mes, 1);
        LocalDate fim = inicio.withDayOfMonth(inicio.lengthOfMonth());

        Map<Integer, BigDecimal> totalPorDia = new LinkedHashMap<>();
        for (int dia = 1; dia <= fim.getDayOfMonth(); dia++) {
            totalPorDia.put(dia, BigDecimal.ZERO);
        }
        repository.findByUsuarioIdAndDataBetweenOrderByDataDescIdDesc(usuarioId, inicio, fim)
                .forEach(g -> totalPorDia.merge(g.getData().getDayOfMonth(), g.getValor(), BigDecimal::add));

        return totalPorDia.entrySet().stream()
                .map(e -> new TotalDiarioDTO(e.getKey(), e.getValue()))
                .collect(Collectors.toList());
    }

    // Chave de agrupamento por categoria usada no ranking e na comparação mensal - a
    // mesma dupla (categoriaId, nome legado em minúsculas) usada como GROUP BY nas
    // queries de agregação, pra tratar corretamente gastos legados sem categoriaId
    // (ver comentário em GastoRepository.somarPorCategoriaNoPeriodo).
    private record CategoriaChave(Integer categoriaId, String categoria) {
    }

    public RankingCategoriasDTO rankingCategorias(int mes, int ano, Integer usuarioId) {
        validarMesAno(mes, ano);
        LocalDate inicio = LocalDate.of(ano, mes, 1);
        LocalDate fim = inicio.withDayOfMonth(inicio.lengthOfMonth());

        BigDecimal totalGeral = repository.somarNoPeriodo(usuarioId, inicio, fim);
        List<GastoRepository.CategoriaSubcategoriaTotal> linhas =
                repository.somarPorCategoriaESubcategoriaNoPeriodo(usuarioId, inicio, fim);

        Map<CategoriaChave, List<GastoRepository.CategoriaSubcategoriaTotal>> porCategoria = linhas.stream()
                .collect(Collectors.groupingBy(
                        l -> new CategoriaChave(l.getCategoriaId(), l.getCategoria()),
                        LinkedHashMap::new, Collectors.toList()));

        List<RankingCategoriaDTO> categorias = new ArrayList<>();
        for (Map.Entry<CategoriaChave, List<GastoRepository.CategoriaSubcategoriaTotal>> entrada : porCategoria.entrySet()) {
            BigDecimal totalCategoria = entrada.getValue().stream()
                    .map(GastoRepository.CategoriaSubcategoriaTotal::getTotal)
                    .reduce(BigDecimal.ZERO, BigDecimal::add);

            List<RankingSubcategoriaDTO> subcategorias = entrada.getValue().stream()
                    .map(l -> new RankingSubcategoriaDTO(
                            l.getSubcategoriaId(), l.getSubcategoria(), l.getTotal(),
                            percentual(l.getTotal(), totalCategoria)))
                    .sorted(Comparator.comparing(RankingSubcategoriaDTO::getTotal).reversed())
                    .collect(Collectors.toList());

            categorias.add(new RankingCategoriaDTO(
                    entrada.getKey().categoriaId(), entrada.getKey().categoria(), totalCategoria,
                    percentual(totalCategoria, totalGeral), subcategorias));
        }
        categorias.sort(Comparator.comparing(RankingCategoriaDTO::getTotal).reversed());

        return new RankingCategoriasDTO(totalGeral, categorias);
    }

    public ComparacaoMensalDTO comparacaoMensal(int mes, int ano, Integer usuarioId) {
        validarMesAno(mes, ano);
        LocalDate inicioAtual = LocalDate.of(ano, mes, 1);
        LocalDate fimAtual = inicioAtual.withDayOfMonth(inicioAtual.lengthOfMonth());

        YearMonth mesAnteriorYm = YearMonth.of(ano, mes).minusMonths(1);
        LocalDate inicioAnterior = mesAnteriorYm.atDay(1);
        LocalDate fimAnterior = mesAnteriorYm.atEndOfMonth();

        Map<CategoriaChave, BigDecimal> totalAtualPorCategoria = totalPorCategoria(usuarioId, inicioAtual, fimAtual);
        Map<CategoriaChave, BigDecimal> totalAnteriorPorCategoria =
                totalPorCategoria(usuarioId, inicioAnterior, fimAnterior);

        // LinkedHashSet preserva a ordem de chegada (mês atual primeiro) antes do sort final.
        Set<CategoriaChave> todasCategorias = new LinkedHashSet<>(totalAtualPorCategoria.keySet());
        todasCategorias.addAll(totalAnteriorPorCategoria.keySet());

        List<ComparacaoCategoriaDTO> categorias = new ArrayList<>();
        for (CategoriaChave chave : todasCategorias) {
            BigDecimal totalAtual = totalAtualPorCategoria.getOrDefault(chave, BigDecimal.ZERO);
            BigDecimal totalAnterior = totalAnteriorPorCategoria.getOrDefault(chave, BigDecimal.ZERO);
            BigDecimal variacaoAbsoluta = totalAtual.subtract(totalAnterior);

            // Sem gasto nenhum no mês anterior: variação percentual não é definida (não dá
            // pra calcular "aumento de X%" a partir de uma base zero) - o front mostra "Nova".
            boolean categoriaNova = totalAnterior.compareTo(BigDecimal.ZERO) == 0;
            BigDecimal variacaoPercentual = categoriaNova ? null : percentual(variacaoAbsoluta, totalAnterior);

            categorias.add(new ComparacaoCategoriaDTO(
                    chave.categoriaId(), chave.categoria(), totalAtual, totalAnterior,
                    variacaoAbsoluta, variacaoPercentual, categoriaNova));
        }
        categorias.sort(Comparator.comparing(ComparacaoCategoriaDTO::getTotalAtual).reversed());

        return new ComparacaoMensalDTO(mes, ano, mesAnteriorYm.getMonthValue(), mesAnteriorYm.getYear(), categorias);
    }

    private Map<CategoriaChave, BigDecimal> totalPorCategoria(Integer usuarioId, LocalDate inicio, LocalDate fim) {
        return repository.somarPorCategoriaNoPeriodo(usuarioId, inicio, fim).stream()
                .collect(Collectors.toMap(
                        c -> new CategoriaChave(c.getCategoriaId(), c.getCategoria()),
                        GastoRepository.CategoriaTotal::getTotal,
                        BigDecimal::add, LinkedHashMap::new));
    }

    private BigDecimal percentual(BigDecimal valor, BigDecimal total) {
        if (total == null || total.compareTo(BigDecimal.ZERO) == 0) {
            return BigDecimal.ZERO;
        }
        return valor.multiply(BigDecimal.valueOf(100)).divide(total, 2, RoundingMode.HALF_UP);
    }

    private void validarMesAno(int mes, int ano) {
        if (mes < 1 || mes > 12) {
            throw new IllegalArgumentException("Mês inválido, informe um valor entre 1 e 12.");
        }
        if (ano <= 0) {
            throw new IllegalArgumentException("Ano inválido.");
        }
    }

    private void validarOrcamento(Integer orcamentoId, Integer usuarioId) {
        if (orcamentoId == null) {
            return;
        }
        orcamentoRepository.findByIdAndUsuarioId(orcamentoId, usuarioId)
                .orElseThrow(() -> new OrcamentoInvalidoException("Orçamento não encontrado ou não pertence ao usuário."));
    }

    private void validar(Gasto gasto) {
        if (gasto.getDescricao() == null || gasto.getDescricao().isBlank()) {
            throw new IllegalArgumentException("Descrição não pode ser vazia.");
        }
        if (gasto.getValor() == null || gasto.getValor().compareTo(BigDecimal.ZERO) <= 0) {
            throw new IllegalArgumentException("Valor deve ser maior que zero.");
        }
        if (gasto.getCategoriaId() == null) {
            throw new IllegalArgumentException("Categoria não pode ser vazia.");
        }
        // gasto.getData() pode vir null aqui - salvar()/salvarParcelas() só aplicam o
        // default (hoje) DEPOIS de validar(); nesse caso não há data pra checar ainda.
        if (gasto.getData() != null) {
            validarData(gasto.getData());
        }
    }

    // Janela grosseira de data (ver comentário nas constantes) - extraída pra o
    // fluxo de pagamento (GastoService.pagar) validar a data real informada com o
    // mesmo critério do cadastro.
    private void validarData(LocalDate data) {
        LocalDate hoje = LocalDate.now();
        if (data.isBefore(hoje.minusYears(GASTO_ANOS_PASSADO_MAXIMO))) {
            throw new IllegalArgumentException(
                    "Data do gasto não pode ser anterior a " + GASTO_ANOS_PASSADO_MAXIMO + " anos atrás.");
        }
        if (data.isAfter(hoje.plusYears(GASTO_ANOS_FUTURO_MAXIMO))) {
            throw new IllegalArgumentException(
                    "Data do gasto não pode ser mais de " + GASTO_ANOS_FUTURO_MAXIMO + " anos no futuro.");
        }
    }
}
