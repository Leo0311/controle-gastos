package com.controlegastos.api.service;

import com.controlegastos.api.model.Categoria;
import com.controlegastos.api.model.CompraParcelada;
import com.controlegastos.api.model.Gasto;
import com.controlegastos.api.repository.CategoriaRepository;
import com.controlegastos.api.repository.CompraParceladaRepository;
import com.controlegastos.api.repository.GastoRepository;
import com.controlegastos.api.repository.OrcamentoRepository;
import com.controlegastos.api.repository.SubcategoriaRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.YearMonth;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.junit.jupiter.api.Assumptions.assumeTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

/**
 * Aritmética de CompraParceladaService.gerarParcelas (divisão em centavos +
 * ajuste da última parcela), a validação da parcela mínima, e a matemática de
 * data (mesDaPrimeiraParcela + clamping do dia no loop de parcelas) - Mockito
 * puro, sem banco e sem @SpringBootTest.
 */
class CompraParceladaServiceTest {

    private static final int USUARIO = 1;
    private static final int CATEGORIA = 10;

    private final CompraParceladaRepository repository = mock(CompraParceladaRepository.class);
    private final GastoRepository gastoRepository = mock(GastoRepository.class);
    private final GastoService gastoService = mock(GastoService.class);
    private final CategoriaRepository categoriaRepository = mock(CategoriaRepository.class);
    private final SubcategoriaRepository subcategoriaRepository = mock(SubcategoriaRepository.class);
    private final OrcamentoRepository orcamentoRepository = mock(OrcamentoRepository.class);

    private final CompraParceladaService service = new CompraParceladaService(
            repository, gastoRepository, gastoService,
            categoriaRepository, subcategoriaRepository, orcamentoRepository);

    @BeforeEach
    void stubsPadrao() {
        Categoria categoria = new Categoria();
        categoria.setId(CATEGORIA);
        categoria.setNome("Compras");
        categoria.setEmoji("🛍️");
        when(categoriaRepository.findByIdVisivel(any(), any())).thenReturn(Optional.of(categoria));

        // repository.save devolve a mesma compra já com um id - gerarParcelas usa
        // compra.getId() pra vincular cada parcela à compra de origem.
        when(repository.save(any(CompraParcelada.class))).thenAnswer(invocacao -> {
            CompraParcelada c = invocacao.getArgument(0);
            c.setId(99);
            return c;
        });
    }

    private CompraParcelada compra(String valorTotal, int numeroParcelas) {
        return compra(valorTotal, numeroParcelas, 10);
    }

    private CompraParcelada compra(String valorTotal, int numeroParcelas, int diaDoMes) {
        CompraParcelada dados = new CompraParcelada();
        dados.setDescricao("Notebook");
        dados.setValorTotal(new BigDecimal(valorTotal));
        dados.setNumeroParcelas(numeroParcelas);
        dados.setCategoriaId(CATEGORIA);
        dados.setDiaDoMes(diaDoMes);
        return dados;
    }

    private List<Gasto> parcelasGeradas(int quantidadeEsperada) {
        ArgumentCaptor<Gasto> captor = ArgumentCaptor.forClass(Gasto.class);
        verify(gastoService, times(quantidadeEsperada)).cadastrarVinculadoAParcelada(captor.capture(), any());
        return captor.getAllValues();
    }

    private static BigDecimal somar(List<Gasto> parcelas) {
        return parcelas.stream().map(Gasto::getValor).reduce(BigDecimal.ZERO, BigDecimal::add);
    }

    @Test
    void rejeitaValorBaixoDemaisParaONumeroDeParcelasSemGravarNada() {
        assertThatThrownBy(() -> service.cadastrar(compra("0.03", 5), USUARIO))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("muito baixo");

        verify(repository, never()).save(any());
        verifyNoInteractions(gastoService);
    }

    @Test
    void divisaoQueNaoFechaAjustaAUltimaParcelaEOTotalBateExatamente() {
        service.cadastrar(compra("100.00", 3), USUARIO);

        List<Gasto> parcelas = parcelasGeradas(3);
        assertThat(parcelas.get(0).getValor()).isEqualByComparingTo("33.33");
        assertThat(parcelas.get(1).getValor()).isEqualByComparingTo("33.33");
        assertThat(parcelas.get(2).getValor()).isEqualByComparingTo("33.34");
        assertThat(somar(parcelas)).isEqualByComparingTo("100.00");
    }

    @Test
    void casoLimiteValidoCincoCentavosEmCincoVezesGeraCincoParcelasDeUmCentavo() {
        service.cadastrar(compra("0.05", 5), USUARIO);

        List<Gasto> parcelas = parcelasGeradas(5);
        assertThat(parcelas).hasSize(5);
        parcelas.forEach(parcela -> assertThat(parcela.getValor()).isEqualByComparingTo("0.01"));
        assertThat(somar(parcelas)).isEqualByComparingTo("0.05");
    }

    @Test
    void primeiraParcelaVaiParaOMesSeguinteQuandoODiaEscolhidoJaPassouOuEHoje() {
        LocalDate hoje = LocalDate.now();
        // dia 1: em qualquer data do mês, essa ocorrência já passou (ou é hoje),
        // então a primeira parcela nunca é retroativa - pula pro mês seguinte.
        service.cadastrar(compra("300.00", 3, 1), USUARIO);

        List<Gasto> parcelas = parcelasGeradas(3);
        assertThat(parcelas.get(0).getData()).isAfter(hoje);
        assertThat(YearMonth.from(parcelas.get(0).getData()))
                .isEqualTo(YearMonth.from(hoje).plusMonths(1));
    }

    @Test
    void primeiraParcelaFicaNoMesAtualQuandoODiaEscolhidoAindaNaoChegou() {
        LocalDate hoje = LocalDate.now();
        assumeTrue(hoje.getDayOfMonth() < hoje.lengthOfMonth(),
                "cenário exige que ainda exista um dia futuro no mês corrente");

        service.cadastrar(compra("300.00", 3, hoje.getDayOfMonth() + 1), USUARIO);

        List<Gasto> parcelas = parcelasGeradas(3);
        assertThat(parcelas.get(0).getData()).isAfter(hoje);
        assertThat(YearMonth.from(parcelas.get(0).getData())).isEqualTo(YearMonth.from(hoje));
    }

    @Test
    void clampingDeDia_parcelaNoDia31CaiNoUltimoDiaDeFevereiroInclusiveEmAnoBissexto() {
        // 60 parcelas cobrem 5 anos - qualquer janela desse tamanho contém um
        // fevereiro comum (28), um fevereiro bissexto (29) e meses de 30 dias.
        service.cadastrar(compra("6000.00", 60, 31), USUARIO);

        List<LocalDate> datas = parcelasGeradas(60).stream().map(Gasto::getData).toList();

        for (LocalDate data : datas) {
            assertThat(data.getDayOfMonth())
                    .isEqualTo(Math.min(31, data.lengthOfMonth()));
        }

        LocalDate fevereiroBissexto = datas.stream()
                .filter(data -> data.getMonthValue() == 2 && data.lengthOfMonth() == 29)
                .findFirst()
                .orElseThrow(() -> new AssertionError("esperava um fevereiro bissexto no horizonte de 60 parcelas"));
        assertThat(fevereiroBissexto.getDayOfMonth()).isEqualTo(29);

        LocalDate fevereiroComum = datas.stream()
                .filter(data -> data.getMonthValue() == 2 && data.lengthOfMonth() == 28)
                .findFirst()
                .orElseThrow(() -> new AssertionError("esperava um fevereiro comum no horizonte de 60 parcelas"));
        assertThat(fevereiroComum.getDayOfMonth()).isEqualTo(28);

        LocalDate mesDe30Dias = datas.stream()
                .filter(data -> data.lengthOfMonth() == 30)
                .findFirst()
                .orElseThrow(() -> new AssertionError("esperava um mês de 30 dias no horizonte de 60 parcelas"));
        assertThat(mesDe30Dias.getDayOfMonth()).isEqualTo(30);
    }
}
