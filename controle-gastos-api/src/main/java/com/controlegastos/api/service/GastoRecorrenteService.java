package com.controlegastos.api.service;

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
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.YearMonth;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.Optional;
import java.util.Set;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class GastoRecorrenteService {

    private final GastoRecorrenteRepository repository;
    private final GastoRepository gastoRepository;
    private final GastoService gastoService;
    private final CategoriaRepository categoriaRepository;
    private final SubcategoriaRepository subcategoriaRepository;
    private final OrcamentoRepository orcamentoRepository;

    public List<GastoRecorrente> listarTodos(Integer usuarioId) {
        return repository.findAllByUsuarioIdOrderByDescricaoAsc(usuarioId);
    }

    public GastoRecorrente buscarPorId(Integer id, Integer usuarioId) {
        return repository.findByIdAndUsuarioId(id, usuarioId)
                .orElseThrow(() -> new RecursoNaoEncontradoException("Gasto recorrente não encontrado com ID " + id));
    }

    // Além do lançamento sob demanda de sempre, agora também pré-gera imediatamente
    // os gastos dos próximos "mesesGerar" meses (ver gerarProximosMeses) - assim
    // meses futuros já aparecem no Dashboard/Análises sem esperar o usuário abrir
    // aquele mês especificamente depois que ele chegar.
    @Transactional
    public GastoRecorrente cadastrar(GastoRecorrente dados, Integer usuarioId) {
        validar(dados);
        CategoriaResolvida categoria = resolverCategoria(dados, usuarioId);
        validarOrcamento(dados.getOrcamentoId(), usuarioId);
        dados.setId(null);
        dados.setUsuarioId(usuarioId);
        dados.setAtivo(true);
        dados.setDataCriacao(LocalDateTime.now());
        GastoRecorrente salvo = repository.save(dados);
        gerarProximosMeses(salvo, usuarioId, dados.getMesesGerar(), categoria, true);
        return salvo;
    }

    // Reaplica gerarProximosMeses com o horizonte informado na edição - como a
    // geração é idempotente (nunca duplica um mês já lançado), isso só tem efeito
    // prático quando o usuário aumenta "mesesGerar" em relação ao que já existia,
    // estendendo a pré-geração pros meses recém-incluídos no horizonte.
    @Transactional
    public GastoRecorrente atualizar(Integer id, GastoRecorrente dados, Integer usuarioId) {
        GastoRecorrente existente = buscarPorId(id, usuarioId);
        validar(dados);
        CategoriaResolvida categoria = resolverCategoria(dados, usuarioId);
        validarOrcamento(dados.getOrcamentoId(), usuarioId);
        existente.setDescricao(dados.getDescricao());
        existente.setValor(dados.getValor());
        existente.setCategoriaId(dados.getCategoriaId());
        existente.setSubcategoriaId(dados.getSubcategoriaId());
        existente.setDiaDoMes(dados.getDiaDoMes());
        existente.setOrcamentoId(dados.getOrcamentoId());
        GastoRecorrente salvo = repository.save(existente);
        gerarProximosMeses(salvo, usuarioId, dados.getMesesGerar(), categoria, false);
        return salvo;
    }

    public GastoRecorrente alternarAtivo(Integer id, Integer usuarioId) {
        GastoRecorrente existente = buscarPorId(id, usuarioId);
        existente.setAtivo(!existente.getAtivo());
        return repository.save(existente);
    }

    // Exclui a recorrência INTEIRA em cascata: todos os gastos gerados por ela
    // (passados e futuros) mais o registro da recorrência. Mesmo ponto usado quando
    // a exclusão é disparada pela aba Gastos (excluir um lançamento dela) - a lógica
    // vive em GastoService.excluirRecorrenciaEmCascata pra não haver duas cópias, e
    // é atômica (@Transactional lá).
    public void excluir(Integer id, Integer usuarioId) {
        gastoService.excluirRecorrenciaEmCascata(id, usuarioId);
    }

    // Verifica todas as recorrências ativas do usuário e lança o gasto do mês atual
    // pra cada uma cujo dia já chegou e que ainda não foi lançada neste mês. Chamado
    // sob demanda (não há cron job garantido no Render free tier) a partir do
    // frontend, ao abrir o Dashboard ou a tela de Gastos - ver GastoRecorrenteController.
    // Idempotente: pode ser chamado várias vezes no mesmo mês sem duplicar nada.
    public List<Gasto> lancarPendentes(Integer usuarioId) {
        LocalDate hoje = LocalDate.now();
        List<GastoRecorrente> ativos = repository.findByUsuarioIdAndAtivoTrue(usuarioId);
        List<Gasto> lancados = new ArrayList<>();

        for (GastoRecorrente recorrente : ativos) {
            tentarLancar(recorrente, usuarioId, hoje).ifPresent(lancados::add);
        }
        return lancados;
    }

    // Ação em lote: marca como pagas todas as ocorrências PENDENTES desta
    // recorrência cujo vencimento já chegou (<= hoje), usando o valor e a data
    // previstos de cada uma - sem confirmação item a item. Ocorrências de meses
    // futuros pré-geradas ficam intactas (não se paga uma conta que ainda não
    // venceu). Devolve os gastos que foram quitados.
    @Transactional
    public List<Gasto> pagarVencidas(Integer recorrenteId, Integer usuarioId) {
        buscarPorId(recorrenteId, usuarioId); // valida escopo do usuário
        LocalDate hoje = LocalDate.now();
        List<Gasto> pendentes = gastoRepository
                .findByGastoRecorrenteIdAndStatusPagamento(recorrenteId, StatusPagamento.PENDENTE);

        List<Gasto> quitados = new ArrayList<>();
        for (Gasto gasto : pendentes) {
            LocalDate vencimento = gasto.getVencimentoOriginal() != null
                    ? gasto.getVencimentoOriginal() : gasto.getData();
            if (vencimento.isAfter(hoje)) {
                continue;
            }
            gasto.setVencimentoOriginal(vencimento);
            gasto.setData(vencimento);
            gasto.setDataPagamento(vencimento);
            gasto.setStatusPagamento(StatusPagamento.PAGO);
            quitados.add(gasto);
        }
        gastoRepository.saveAll(quitados);
        return quitados;
    }

    // Pré-gera os gastos dos próximos "mesesGerar" meses (1 a 12, já validado em
    // validar()) a partir de hoje - chamada ao criar ou editar uma recorrência.
    //
    // Otimização de round-trips (achado 2.3): antes era, por mês, 1 exists de
    // duplicata + 1 resolução de categoria + 1 insert individual (~3-5 idas ao
    // banco por mês, ~38 no total pra mesesGerar=12). Agora:
    // - categoria/subcategoria resolvidas UMA vez pelo chamador (parâmetro);
    // - numa recorrência NOVA não há gasto vinculado nenhum, então os "já
    //   lançados" são vazios sem consultar o banco; numa edição, uma query só
    //   traz todas as datas do horizonte;
    // - os meses a inserir vão num único batch JDBC (inserirEmLote).
    //
    // Mês corrente: numa recorrência NOVA entra SEMPRE no mesmo batch, mesmo que o
    // dia do vencimento ainda não tenha chegado - senão a recorrência sumiria de
    // Gastos/Dashboard/"Próximas contas" até o dia chegar. Não há corrida com o
    // lançamento sob demanda (a recorrência só fica visível pro lancarPendentes
    // depois do commit desta transação) e o lancarPendentes posterior é idempotente
    // (exists por mês em tentarLancar + índice uq_gastos_recorrente_mes). Numa
    // EDIÇÃO, continua pelo tentarLancar, que só cria o mês corrente quando o dia
    // já chegou e trata a corrida com um lancarPendentes concorrente.
    private void gerarProximosMeses(GastoRecorrente recorrente, Integer usuarioId, int mesesGerar,
                                    CategoriaResolvida categoria, boolean recorrenciaNova) {
        LocalDate hoje = LocalDate.now();

        Set<YearMonth> jaLancados = recorrenciaNova
                ? Collections.emptySet()
                : gastoRepository.vencimentosDosGastosDaRecorrente(recorrente.getId(), hoje.withDayOfMonth(1)).stream()
                        .map(YearMonth::from)
                        .collect(Collectors.toSet());

        List<Gasto> aInserir = new ArrayList<>();

        if (recorrenciaNova) {
            LocalDate dataMesCorrente = dataDoLancamento(recorrente.getDiaDoMes(), hoje);
            aInserir.add(montarGasto(recorrente, categoria, dataMesCorrente, usuarioId));
        } else {
            tentarLancar(recorrente, usuarioId, hoje);
        }

        for (int i = 1; i < mesesGerar; i++) {
            LocalDate data = dataDoLancamento(recorrente.getDiaDoMes(), hoje.plusMonths(i));
            if (!jaLancados.contains(YearMonth.from(data))) {
                aInserir.add(montarGasto(recorrente, categoria, data, usuarioId));
            }
        }

        if (aInserir.isEmpty()) {
            return;
        }
        try {
            gastoRepository.inserirEmLote(aInserir);
        } catch (RuntimeException e) {
            // Uma recorrência com problema não deve travar o salvamento da
            // recorrência em si - mesma garantia do laço individual antigo.
        }
    }

    private Gasto montarGasto(GastoRecorrente recorrente, CategoriaResolvida categoria,
                              LocalDate data, Integer usuarioId) {
        Gasto gasto = new Gasto();
        gasto.setDescricao(recorrente.getDescricao());
        gasto.setValor(recorrente.getValor());
        gasto.setCategoriaId(recorrente.getCategoriaId());
        gasto.setCategoria(categoria.categoriaNome());
        gasto.setSubcategoriaId(recorrente.getSubcategoriaId());
        gasto.setSubcategoria(categoria.subcategoriaNome());
        gasto.setOrcamentoId(recorrente.getOrcamentoId());
        gasto.setData(data);
        gasto.setUsuarioId(usuarioId);
        gasto.setGastoRecorrenteId(recorrente.getId());
        // Pré-gerado = previsto, ainda não pago. A data do lançamento é o vencimento.
        gasto.setStatusPagamento(StatusPagamento.PENDENTE);
        gasto.setVencimentoOriginal(data);
        return gasto;
    }

    // Lança o gasto da recorrência pro mês de referência, se o dia já chegou (ou já
    // passou) e ainda não foi lançado neste mês; devolve vazio nos dois casos em que
    // não há nada a fazer (dia ainda não chegou, ou já foi lançado) e também se o
    // lançamento falhar (ex: categoria/orçamento vinculado foi excluído depois que a
    // recorrência foi criada) - uma recorrência com problema nunca deve travar as
    // demais, nem virar um erro visível toda vez que o usuário abre Dashboard/Gastos.
    private Optional<Gasto> tentarLancar(GastoRecorrente recorrente, Integer usuarioId, LocalDate referencia) {
        LocalDate dataLancamento = dataDoLancamento(recorrente.getDiaDoMes(), referencia);
        if (dataLancamento.isAfter(referencia)) {
            return Optional.empty();
        }

        LocalDate inicioMes = referencia.withDayOfMonth(1);
        LocalDate fimMes = referencia.withDayOfMonth(referencia.lengthOfMonth());
        boolean jaLancado = gastoRepository
                .existsByGastoRecorrenteIdAndVencimentoOriginalBetween(recorrente.getId(), inicioMes, fimMes);
        if (jaLancado) {
            return Optional.empty();
        }

        Gasto gasto = new Gasto();
        gasto.setDescricao(recorrente.getDescricao());
        gasto.setValor(recorrente.getValor());
        gasto.setCategoriaId(recorrente.getCategoriaId());
        gasto.setSubcategoriaId(recorrente.getSubcategoriaId());
        gasto.setOrcamentoId(recorrente.getOrcamentoId());
        gasto.setData(dataLancamento);
        gasto.setGastoRecorrenteId(recorrente.getId());
        gasto.setStatusPagamento(StatusPagamento.PENDENTE);
        gasto.setVencimentoOriginal(dataLancamento);
        try {
            return Optional.of(gastoService.cadastrarVinculadoARecorrente(gasto, usuarioId));
        } catch (DataIntegrityViolationException e) {
            // uq_gastos_recorrente_mes: outra requisição concorrente já lançou o gasto
            // deste mês entre a checagem acima e este insert - a corrida perdeu, não é erro.
            return Optional.empty();
        } catch (RuntimeException e) {
            return Optional.empty();
        }
    }

    // Dia configurado, ajustado pro último dia válido do mês de referência quando
    // esse mês tem menos dias que o configurado (ex: dia 31 configurado, mas
    // fevereiro só tem 28/29 - lança no último dia de fevereiro).
    private LocalDate dataDoLancamento(int diaDoMes, LocalDate referencia) {
        int dia = Math.min(diaDoMes, referencia.lengthOfMonth());
        return referencia.withDayOfMonth(dia);
    }

    // Nomes de categoria/subcategoria já resolvidos, pra gerarProximosMeses gravar
    // em cada gasto sem o GastoService ter que buscar de novo por mês (achado 2.3
    // - mesmo padrão de CompraParceladaService.CategoriaResolvida). subcategoriaNome
    // é null quando a recorrência não tem subcategoria.
    private record CategoriaResolvida(String categoriaNome, String subcategoriaNome) { }

    // Confirma que categoria (e subcategoria, se houver) existem e são visíveis pro
    // usuário, e devolve os nomes. Além de validar, é a resolução única usada na
    // pré-geração dos meses.
    private CategoriaResolvida resolverCategoria(GastoRecorrente dados, Integer usuarioId) {
        Categoria categoria = categoriaRepository.findByIdVisivel(dados.getCategoriaId(), usuarioId)
                .orElseThrow(() -> new IllegalArgumentException("Categoria inválida ou não pertence ao usuário."));
        if (dados.getSubcategoriaId() == null) {
            return new CategoriaResolvida(categoria.getNome(), null);
        }
        Subcategoria subcategoria = subcategoriaRepository
                .findByIdVisivel(dados.getSubcategoriaId(), usuarioId)
                .orElseThrow(() -> new IllegalArgumentException("Subcategoria inválida ou não pertence ao usuário."));
        if (!subcategoria.getCategoriaId().equals(categoria.getId())) {
            throw new IllegalArgumentException("Subcategoria não pertence à categoria selecionada.");
        }
        return new CategoriaResolvida(categoria.getNome(), subcategoria.getNome());
    }

    private void validarOrcamento(Integer orcamentoId, Integer usuarioId) {
        if (orcamentoId == null) {
            return;
        }
        orcamentoRepository.findByIdAndUsuarioId(orcamentoId, usuarioId)
                .orElseThrow(() -> new OrcamentoInvalidoException("Orçamento não encontrado ou não pertence ao usuário."));
    }

    private void validar(GastoRecorrente dados) {
        if (dados.getDescricao() == null || dados.getDescricao().isBlank()) {
            throw new IllegalArgumentException("Descrição não pode ser vazia.");
        }
        if (dados.getValor() == null || dados.getValor().compareTo(BigDecimal.ZERO) <= 0) {
            throw new IllegalArgumentException("Valor deve ser maior que zero.");
        }
        if (dados.getCategoriaId() == null) {
            throw new IllegalArgumentException("Categoria não pode ser vazia.");
        }
        if (dados.getDiaDoMes() == null || dados.getDiaDoMes() < 1 || dados.getDiaDoMes() > 31) {
            throw new IllegalArgumentException("Dia do mês deve estar entre 1 e 31.");
        }
        if (dados.getMesesGerar() == null || dados.getMesesGerar() < 1 || dados.getMesesGerar() > 12) {
            throw new IllegalArgumentException("Gerar para os próximos meses deve estar entre 1 e 12.");
        }
    }
}
