package com.controlegastos.api.service;

import com.controlegastos.api.exception.RecursoNaoEncontradoException;
import com.controlegastos.api.model.Categoria;
import com.controlegastos.api.model.Gasto;
import com.controlegastos.api.model.GastoRecorrente;
import com.controlegastos.api.model.StatusPagamento;
import com.controlegastos.api.repository.CategoriaRepository;
import com.controlegastos.api.repository.GastoRecorrenteRepository;
import com.controlegastos.api.repository.GastoRepository;
import com.controlegastos.api.repository.OrcamentoRepository;
import com.controlegastos.api.repository.SubcategoriaRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatCode;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.junit.jupiter.api.Assumptions.assumeTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.atLeast;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * Matemática de data de GastoRecorrenteService - clamping do dia do mês
 * (dataDoLancamento) e idempotência de lancarPendentes - Mockito puro, sem
 * banco e sem @SpringBootTest, mesmo padrão do CompraParceladaServiceTest.
 *
 * dataDoLancamento e lancarPendentes leem LocalDate.now() diretamente, então
 * os testes se apoiam em invariantes que valem em qualquer data: um mês curto
 * sempre cai no seu último dia, e um lote já lançado nunca é relançado.
 *
 * A pré-geração de meses (gerarProximosMeses) foi otimizada no achado 2.3:
 * categoria resolvida 1x, sem exists por mês numa recorrência nova, e 1 batch
 * (gastoRepository.inserirEmLote) no lugar de N inserts - por isso os testes
 * capturam os gastos gerados do argumento do inserirEmLote (mês corrente + meses
 * futuros numa recorrência nova; só os futuros numa edição) e do
 * cadastrarVinculadoARecorrente (mês corrente, só no fluxo de edição).
 */
class GastoRecorrenteServiceTest {

    private static final int USUARIO = 1;
    private static final int CATEGORIA = 10;
    private static final int RECORRENTE = 77;

    private final GastoRecorrenteRepository repository = mock(GastoRecorrenteRepository.class);
    private final GastoRepository gastoRepository = mock(GastoRepository.class);
    private final GastoService gastoService = mock(GastoService.class);
    private final CategoriaRepository categoriaRepository = mock(CategoriaRepository.class);
    private final SubcategoriaRepository subcategoriaRepository = mock(SubcategoriaRepository.class);
    private final OrcamentoRepository orcamentoRepository = mock(OrcamentoRepository.class);

    private final GastoRecorrenteService service = new GastoRecorrenteService(
            repository, gastoRepository, gastoService,
            categoriaRepository, subcategoriaRepository, orcamentoRepository);

    @BeforeEach
    void stubsPadrao() {
        Categoria categoria = new Categoria();
        categoria.setId(CATEGORIA);
        categoria.setNome("Contas e serviços");
        categoria.setEmoji("💡");
        when(categoriaRepository.findByIdVisivel(any(), any())).thenReturn(Optional.of(categoria));

        // repository.save devolve a recorrência já com id - gerarProximosMeses usa
        // recorrente.getId() pra vincular cada gasto gerado.
        when(repository.save(any(GastoRecorrente.class))).thenAnswer(invocacao -> {
            GastoRecorrente r = invocacao.getArgument(0);
            r.setId(RECORRENTE);
            return r;
        });

        when(gastoService.cadastrarVinculadoARecorrente(any(), any()))
                .thenAnswer(invocacao -> invocacao.getArgument(0));

        // Numa edição, gerarProximosMeses consulta as datas já lançadas - vazio por
        // padrão (nenhum mês do horizonte pré-gerado ainda).
        when(gastoRepository.vencimentosDosGastosDaRecorrente(any(), any())).thenReturn(List.of());
    }

    private GastoRecorrente recorrente(int diaDoMes, Integer mesesGerar) {
        GastoRecorrente dados = new GastoRecorrente();
        dados.setId(RECORRENTE);
        dados.setDescricao("Assinatura");
        dados.setValor(new BigDecimal("29.90"));
        dados.setCategoriaId(CATEGORIA);
        dados.setDiaDoMes(diaDoMes);
        dados.setMesesGerar(mesesGerar);
        return dados;
    }

    // Datas de todos os gastos gerados na pré-geração: os meses futuros vêm no
    // argumento do inserirEmLote (batch único); o mês corrente, quando lançado
    // numa edição, vem pelo cadastrarVinculadoARecorrente.
    @SuppressWarnings("unchecked")
    private List<LocalDate> datasGeradas() {
        List<LocalDate> datas = new ArrayList<>();

        ArgumentCaptor<List<Gasto>> lote = ArgumentCaptor.forClass(List.class);
        verify(gastoRepository, atLeast(0)).inserirEmLote(lote.capture());
        lote.getAllValues().forEach(gastos -> gastos.forEach(g -> datas.add(g.getData())));

        ArgumentCaptor<Gasto> mesCorrente = ArgumentCaptor.forClass(Gasto.class);
        verify(gastoService, atLeast(0)).cadastrarVinculadoARecorrente(mesCorrente.capture(), any());
        mesCorrente.getAllValues().forEach(g -> datas.add(g.getData()));

        return datas;
    }

    // Todos os gastos gerados na pré-geração (batch + eventual mês corrente por
    // insert individual), como objetos completos - pra checar status/vencimento.
    @SuppressWarnings("unchecked")
    private List<Gasto> gastosGerados() {
        List<Gasto> gastos = new ArrayList<>();
        ArgumentCaptor<List<Gasto>> lote = ArgumentCaptor.forClass(List.class);
        verify(gastoRepository, atLeast(0)).inserirEmLote(lote.capture());
        lote.getAllValues().forEach(gastos::addAll);
        ArgumentCaptor<Gasto> mesCorrente = ArgumentCaptor.forClass(Gasto.class);
        verify(gastoService, atLeast(0)).cadastrarVinculadoARecorrente(mesCorrente.capture(), any());
        gastos.addAll(mesCorrente.getAllValues());
        return gastos;
    }

    @Test
    void cadastrar_preGeraTudoComoPendenteEComVencimentoIgualAData() {
        service.cadastrar(recorrente(15, 6), USUARIO);

        List<Gasto> gastos = gastosGerados();
        assertThat(gastos).isNotEmpty();
        assertThat(gastos).allSatisfy(g -> {
            assertThat(g.getStatusPagamento()).isEqualTo(StatusPagamento.PENDENTE);
            assertThat(g.getVencimentoOriginal()).isEqualTo(g.getData());
            assertThat(g.getDataPagamento()).isNull();
        });
    }

    @Test
    void pagarVencidas_marcaSoAsVencidasComoPagasEDeixaAsFuturasIntactas() {
        GastoRecorrente rec = recorrente(10, 3);
        when(repository.findByIdAndUsuarioId(RECORRENTE, USUARIO)).thenReturn(Optional.of(rec));

        LocalDate hoje = LocalDate.now();
        Gasto vencida = gastoPendente(hoje.minusMonths(1));
        Gasto hojeGasto = gastoPendente(hoje);
        Gasto futura = gastoPendente(hoje.plusMonths(1));
        when(gastoRepository.findByGastoRecorrenteIdAndStatusPagamento(RECORRENTE, StatusPagamento.PENDENTE))
                .thenReturn(List.of(vencida, hojeGasto, futura));

        List<Gasto> quitados = service.pagarVencidas(RECORRENTE, USUARIO);

        assertThat(quitados).containsExactlyInAnyOrder(vencida, hojeGasto);
        assertThat(vencida.getStatusPagamento()).isEqualTo(StatusPagamento.PAGO);
        assertThat(vencida.getDataPagamento()).isEqualTo(vencida.getVencimentoOriginal());
        assertThat(hojeGasto.getStatusPagamento()).isEqualTo(StatusPagamento.PAGO);
        assertThat(futura.getStatusPagamento()).isEqualTo(StatusPagamento.PENDENTE);
        verify(gastoRepository).saveAll(quitados);
    }

    private Gasto gastoPendente(LocalDate vencimento) {
        Gasto g = new Gasto();
        g.setValor(new BigDecimal("29.90"));
        g.setData(vencimento);
        g.setVencimentoOriginal(vencimento);
        g.setStatusPagamento(StatusPagamento.PENDENTE);
        g.setGastoRecorrenteId(RECORRENTE);
        return g;
    }

    @Test
    void clampingDeDia_recorrenciaNoDia31CaiSempreNoUltimoDiaDosMesesMaisCurtos() {
        // Horizonte de 12 meses a partir de hoje - qualquer janela desse tamanho
        // contém um fevereiro e um mês de 30 dias, independente da data atual.
        service.cadastrar(recorrente(31, 12), USUARIO);

        List<LocalDate> datas = datasGeradas();
        assertThat(datas).isNotEmpty();

        // Toda ocorrência cai no dia 31 ou, em mês mais curto, no último dia dele.
        for (LocalDate data : datas) {
            assertThat(data.getDayOfMonth())
                    .isEqualTo(Math.min(31, data.lengthOfMonth()));
        }

        LocalDate fevereiro = datas.stream()
                .filter(data -> data.getMonthValue() == 2)
                .findFirst()
                .orElseThrow(() -> new AssertionError("esperava um lançamento em fevereiro no horizonte de 12 meses"));
        assertThat(fevereiro.getDayOfMonth())
                .isEqualTo(fevereiro.lengthOfMonth())
                .isIn(28, 29);

        LocalDate mesDe30Dias = datas.stream()
                .filter(data -> data.lengthOfMonth() == 30)
                .findFirst()
                .orElseThrow(() -> new AssertionError("esperava um lançamento em mês de 30 dias no horizonte de 12 meses"));
        assertThat(mesDe30Dias.getDayOfMonth()).isEqualTo(30);
    }

    @Test
    void cadastrar_preGeracaoResolveCategoriaUmaVezEUsaUmBatchSo() {
        service.cadastrar(recorrente(15, 12), USUARIO);

        // Categoria resolvida 1x (antes: 1 + 1 por mês futuro).
        verify(categoriaRepository, times(1)).findByIdVisivel(CATEGORIA, USUARIO);
        // Recorrência nova não tem gasto vinculado - nenhum exists/consulta de meses.
        verify(gastoRepository, never()).existsByGastoRecorrenteIdAndVencimentoOriginalBetween(any(), any(), any());
        verify(gastoRepository, never()).vencimentosDosGastosDaRecorrente(any(), any());
        // Um batch só, nunca inserts individuais via cadastrarVinculadoARecorrente.
        verify(gastoRepository, times(1)).inserirEmLote(any());
        verify(gastoService, never()).cadastrarVinculadoARecorrente(any(), any());
    }

    @Test
    void cadastrar_geraOMesCorrenteMesmoAntesDoDiaDoVencimentoChegar() {
        // Gap de visibilidade: uma recorrência criada ANTES do dia de vencimento
        // dela no mês corrente (ex: "todo dia 10" criada no dia 6) não deve sumir
        // de Gastos/Dashboard/"Próximas contas" até o dia chegar - o mês corrente
        // é pré-gerado na criação, igual aos meses futuros.
        LocalDate hoje = LocalDate.now();
        assumeTrue(hoje.getDayOfMonth() < hoje.lengthOfMonth(),
                "cenário exige que ainda exista um dia futuro no mês corrente");
        int diaFuturo = hoje.getDayOfMonth() + 1;

        service.cadastrar(recorrente(diaFuturo, 3), USUARIO);

        assertThat(datasGeradas())
                .as("mês corrente (dia ainda não vencido) + 2 meses futuros")
                .contains(hoje.withDayOfMonth(diaFuturo))
                .hasSize(3);
        // Recorrência nova: o mês corrente entra no batch, não pelo insert individual.
        verify(gastoRepository, times(1)).inserirEmLote(any());
        verify(gastoService, never()).cadastrarVinculadoARecorrente(any(), any());
    }

    @Test
    void idempotencia_lancarPendentesDuasVezesNaoDuplicaOGastoDoMes() {
        // dia 1: já chegou (ou é hoje) em qualquer data, então tentarLancar não
        // aborta por "o dia ainda não chegou" e chega na checagem de idempotência.
        GastoRecorrente ativo = recorrente(1, null);
        when(repository.findByUsuarioIdAndAtivoTrue(USUARIO)).thenReturn(List.of(ativo));
        // 1ª passada: ainda não lançado. 2ª passada: já lançado neste mês.
        when(gastoRepository.existsByGastoRecorrenteIdAndVencimentoOriginalBetween(any(), any(), any()))
                .thenReturn(false, true);

        List<Gasto> primeira = service.lancarPendentes(USUARIO);
        List<Gasto> segunda = service.lancarPendentes(USUARIO);

        assertThat(primeira).hasSize(1);
        assertThat(segunda).isEmpty();
        verify(gastoService, times(1)).cadastrarVinculadoARecorrente(any(), any());
    }

    @Test
    void naoLancaNadaAntesDoDiaConfiguradoChegar_semGastoRetroativo() {
        LocalDate hoje = LocalDate.now();
        assumeTrue(hoje.getDayOfMonth() < hoje.lengthOfMonth(),
                "cenário exige que ainda exista um dia futuro no mês corrente");

        GastoRecorrente ativo = recorrente(hoje.getDayOfMonth() + 1, null);
        when(repository.findByUsuarioIdAndAtivoTrue(USUARIO)).thenReturn(List.of(ativo));

        List<Gasto> lancados = service.lancarPendentes(USUARIO);

        assertThat(lancados).isEmpty();
        verify(gastoService, times(0)).cadastrarVinculadoARecorrente(any(), any());
    }

    // ---------- atualizar() - reaplica gerarProximosMeses ao editar ----------

    @Test
    void atualizar_lancaNaoEncontradoQuandoRecorrenciaNaoEhDoUsuario() {
        when(repository.findByIdAndUsuarioId(999, USUARIO)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> service.atualizar(999, recorrente(1, 3), USUARIO))
                .isInstanceOf(RecursoNaoEncontradoException.class);

        verify(repository, never()).save(any());
    }

    @Test
    void atualizar_validaOsDadosNovosAntesDeAlterarOExistente() {
        GastoRecorrente existente = recorrente(1, 3);
        when(repository.findByIdAndUsuarioId(RECORRENTE, USUARIO)).thenReturn(Optional.of(existente));

        GastoRecorrente invalido = recorrente(1, 3);
        invalido.setValor(BigDecimal.ZERO);

        assertThatThrownBy(() -> service.atualizar(RECORRENTE, invalido, USUARIO))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("Valor deve ser maior que zero");

        verify(repository, never()).save(any());
    }

    @Test
    void atualizar_copiaCamposEReaplicaAPreGeracaoPeloHorizonteInformado() {
        GastoRecorrente existente = recorrente(1, 1);
        existente.setDescricao("Assinatura antiga");
        existente.setValor(new BigDecimal("10.00"));
        when(repository.findByIdAndUsuarioId(RECORRENTE, USUARIO)).thenReturn(Optional.of(existente));

        GastoRecorrente dados = recorrente(1, 3);
        dados.setDescricao("Assinatura nova");
        dados.setValor(new BigDecimal("42.00"));

        GastoRecorrente salvo = service.atualizar(RECORRENTE, dados, USUARIO);

        assertThat(salvo.getDescricao()).isEqualTo("Assinatura nova");
        assertThat(salvo.getValor()).isEqualByComparingTo("42.00");
        // Mês corrente (dia 1, já chegou) + 2 meses futuros = 3 lançamentos pré-gerados.
        assertThat(datasGeradas()).hasSize(3);
    }

    @Test
    void atualizar_naoDuplicaOsMesesQueJaForamGerados() {
        GastoRecorrente existente = recorrente(1, 3);
        when(repository.findByIdAndUsuarioId(RECORRENTE, USUARIO)).thenReturn(Optional.of(existente));
        // Mês corrente já lançado...
        when(gastoRepository.existsByGastoRecorrenteIdAndVencimentoOriginalBetween(any(), any(), any())).thenReturn(true);
        // ...e todos os meses futuros do horizonte também.
        LocalDate hoje = LocalDate.now();
        when(gastoRepository.vencimentosDosGastosDaRecorrente(any(), any()))
                .thenReturn(List.of(hoje.plusMonths(1), hoje.plusMonths(2)));

        service.atualizar(RECORRENTE, recorrente(1, 3), USUARIO);

        verify(gastoRepository, never()).inserirEmLote(any());
        verify(gastoService, never()).cadastrarVinculadoARecorrente(any(), any());
    }

    @Test
    void excluir_delegaPraExclusaoEmCascataDoGastoService() {
        service.excluir(RECORRENTE, USUARIO);

        verify(gastoService).excluirRecorrenciaEmCascata(RECORRENTE, USUARIO);
        // Não mexe direto na recorrência nem nos gastos - a cascata (gastos +
        // registro, atômica) vive toda no GastoService.
        verify(repository, never()).delete(any());
        verify(gastoRepository, never()).excluirTodosDaRecorrente(any());
    }

    @Test
    void atualizar_recorrenciaComProblemaNaoTravaAEdicao_catchDoBatch() {
        GastoRecorrente existente = recorrente(1, 3);
        when(repository.findByIdAndUsuarioId(RECORRENTE, USUARIO)).thenReturn(Optional.of(existente));
        // Ex.: o batch de pré-geração estoura (constraint, coluna, etc.) - o catch
        // de gerarProximosMeses engole, o salvamento da recorrência não é revertido.
        doThrow(new RuntimeException("falha no insert em lote"))
                .when(gastoRepository).inserirEmLote(any());

        assertThatCode(() -> service.atualizar(RECORRENTE, recorrente(1, 3), USUARIO))
                .doesNotThrowAnyException();

        verify(repository).save(any());
    }
}
