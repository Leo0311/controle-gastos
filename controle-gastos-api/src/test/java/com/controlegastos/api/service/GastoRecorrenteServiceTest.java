package com.controlegastos.api.service;

import com.controlegastos.api.model.Categoria;
import com.controlegastos.api.model.Gasto;
import com.controlegastos.api.model.GastoRecorrente;
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
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.junit.jupiter.api.Assumptions.assumeTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.atLeast;
import static org.mockito.Mockito.mock;
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
        // recorrente.getId() pra checar duplicidade e vincular cada gasto gerado.
        when(repository.save(any(GastoRecorrente.class))).thenAnswer(invocacao -> {
            GastoRecorrente r = invocacao.getArgument(0);
            r.setId(RECORRENTE);
            return r;
        });

        when(gastoService.cadastrarVinculadoARecorrente(any(), any()))
                .thenAnswer(invocacao -> invocacao.getArgument(0));
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

    private List<LocalDate> datasGeradas() {
        ArgumentCaptor<Gasto> captor = ArgumentCaptor.forClass(Gasto.class);
        verify(gastoService, atLeast(1)).cadastrarVinculadoARecorrente(captor.capture(), any());
        return captor.getAllValues().stream().map(Gasto::getData).toList();
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
    void idempotencia_lancarPendentesDuasVezesNaoDuplicaOGastoDoMes() {
        // dia 1: já chegou (ou é hoje) em qualquer data, então tentarLancar não
        // aborta por "o dia ainda não chegou" e chega na checagem de idempotência.
        GastoRecorrente ativo = recorrente(1, null);
        when(repository.findByUsuarioIdAndAtivoTrue(USUARIO)).thenReturn(List.of(ativo));
        // 1ª passada: ainda não lançado. 2ª passada: já lançado neste mês.
        when(gastoRepository.existsByGastoRecorrenteIdAndDataBetween(any(), any(), any()))
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
}
