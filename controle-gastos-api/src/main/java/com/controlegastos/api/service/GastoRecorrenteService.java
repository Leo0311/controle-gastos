package com.controlegastos.api.service;

import com.controlegastos.api.exception.OrcamentoInvalidoException;
import com.controlegastos.api.exception.RecursoNaoEncontradoException;
import com.controlegastos.api.model.Categoria;
import com.controlegastos.api.model.Gasto;
import com.controlegastos.api.model.GastoRecorrente;
import com.controlegastos.api.model.Subcategoria;
import com.controlegastos.api.repository.CategoriaRepository;
import com.controlegastos.api.repository.GastoRecorrenteRepository;
import com.controlegastos.api.repository.GastoRepository;
import com.controlegastos.api.repository.OrcamentoRepository;
import com.controlegastos.api.repository.SubcategoriaRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;

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
        validarCategoria(dados, usuarioId);
        validarOrcamento(dados.getOrcamentoId(), usuarioId);
        dados.setId(null);
        dados.setUsuarioId(usuarioId);
        dados.setAtivo(true);
        dados.setDataCriacao(LocalDateTime.now());
        GastoRecorrente salvo = repository.save(dados);
        gerarProximosMeses(salvo, usuarioId, dados.getMesesGerar());
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
        validarCategoria(dados, usuarioId);
        validarOrcamento(dados.getOrcamentoId(), usuarioId);
        existente.setDescricao(dados.getDescricao());
        existente.setValor(dados.getValor());
        existente.setCategoriaId(dados.getCategoriaId());
        existente.setSubcategoriaId(dados.getSubcategoriaId());
        existente.setDiaDoMes(dados.getDiaDoMes());
        existente.setOrcamentoId(dados.getOrcamentoId());
        GastoRecorrente salvo = repository.save(existente);
        gerarProximosMeses(salvo, usuarioId, dados.getMesesGerar());
        return salvo;
    }

    public GastoRecorrente alternarAtivo(Integer id, Integer usuarioId) {
        GastoRecorrente existente = buscarPorId(id, usuarioId);
        existente.setAtivo(!existente.getAtivo());
        return repository.save(existente);
    }

    // Exclui a recorrência e remove os gastos já lançados a partir de HOJE (inclusive)
    // - inclui os pré-gerados de meses futuros que ainda não venceram, já que a
    // recorrência deixou de existir. Gastos de meses passados (data anterior a hoje)
    // continuam intactos como histórico: a FK gastos.gasto_recorrente_id é ON DELETE
    // SET NULL (ver schema.sql), então excluir a recorrência só desvincula esses,
    // sem apagar - mesmo padrão usado em CompraParceladaService.excluir.
    @Transactional
    public void excluir(Integer id, Integer usuarioId) {
        GastoRecorrente existente = buscarPorId(id, usuarioId);

        List<Gasto> gastosFuturos = gastoRepository.findByGastoRecorrenteIdAndDataGreaterThanEqual(id, LocalDate.now());
        gastoRepository.deleteAll(gastosFuturos);

        repository.delete(existente);
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

    // Pré-gera os gastos dos próximos "mesesGerar" meses (1 a 12, já validado em
    // validar()) a partir de hoje - chamada ao criar ou editar uma recorrência.
    // Mês atual (i=0): segue a regra de sempre (tentarLancar) - só lança se o dia já
    // chegou, senão o lançamento sob demanda cuida dele quando o dia chegar. Meses
    // seguintes (i=1..mesesGerar-1): inteiramente futuros, então sempre são gerados,
    // sem a checagem de "dia ainda não chegou" (que só faz sentido dentro do mês
    // corrente). Idempotente nos dois casos (mesma checagem de
    // existsByGastoRecorrenteIdAndDataBetween) - chamar de novo numa edição não
    // duplica os meses já gerados antes, só estende pros meses recém-incluídos.
    private void gerarProximosMeses(GastoRecorrente recorrente, Integer usuarioId, Integer mesesGerar) {
        LocalDate hoje = LocalDate.now();

        tentarLancar(recorrente, usuarioId, hoje);
        for (int i = 1; i < mesesGerar; i++) {
            lancarParaMesFuturo(recorrente, usuarioId, hoje.plusMonths(i));
        }
    }

    // Mesma lógica de tentarLancar, mas sem a checagem "o dia ainda não chegou" -
    // usada só pra meses inteiramente futuros na pré-geração (ver gerarProximosMeses),
    // onde essa checagem não se aplica (o mês nem começou ainda).
    private void lancarParaMesFuturo(GastoRecorrente recorrente, Integer usuarioId, LocalDate referencia) {
        LocalDate dataLancamento = dataDoLancamento(recorrente.getDiaDoMes(), referencia);
        LocalDate inicioMes = referencia.withDayOfMonth(1);
        LocalDate fimMes = referencia.withDayOfMonth(referencia.lengthOfMonth());
        boolean jaLancado = gastoRepository
                .existsByGastoRecorrenteIdAndDataBetween(recorrente.getId(), inicioMes, fimMes);
        if (jaLancado) {
            return;
        }

        Gasto gasto = new Gasto();
        gasto.setDescricao(recorrente.getDescricao());
        gasto.setValor(recorrente.getValor());
        gasto.setCategoriaId(recorrente.getCategoriaId());
        gasto.setSubcategoriaId(recorrente.getSubcategoriaId());
        gasto.setOrcamentoId(recorrente.getOrcamentoId());
        gasto.setData(dataLancamento);
        gasto.setGastoRecorrenteId(recorrente.getId());
        try {
            gastoService.cadastrarVinculadoARecorrente(gasto, usuarioId);
        } catch (RuntimeException e) {
            // uma recorrência com problema (ex: orçamento vinculado foi excluído depois)
            // não deve travar a pré-geração dos outros meses
        }
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
                .existsByGastoRecorrenteIdAndDataBetween(recorrente.getId(), inicioMes, fimMes);
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
        try {
            return Optional.of(gastoService.cadastrarVinculadoARecorrente(gasto, usuarioId));
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

    private void validarCategoria(GastoRecorrente dados, Integer usuarioId) {
        Categoria categoria = categoriaRepository.findByIdVisivel(dados.getCategoriaId(), usuarioId)
                .orElseThrow(() -> new IllegalArgumentException("Categoria inválida ou não pertence ao usuário."));
        if (dados.getSubcategoriaId() == null) {
            return;
        }
        Subcategoria subcategoria = subcategoriaRepository
                .findByIdVisivel(dados.getSubcategoriaId(), usuarioId)
                .orElseThrow(() -> new IllegalArgumentException("Subcategoria inválida ou não pertence ao usuário."));
        if (!subcategoria.getCategoriaId().equals(categoria.getId())) {
            throw new IllegalArgumentException("Subcategoria não pertence à categoria selecionada.");
        }
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
