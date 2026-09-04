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
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

/**
 * Aritmética de CompraParceladaService.gerarParcelas (divisão em centavos +
 * ajuste da última parcela), a validação da parcela mínima e da janela da 1ª
 * parcela, e a geração das datas a partir da data informada (sequência de meses
 * + clamping do dia) - Mockito puro, sem banco e sem @SpringBootTest.
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
        return compra(valorTotal, numeroParcelas, LocalDate.now().withDayOfMonth(10));
    }

    private CompraParcelada compra(String valorTotal, int numeroParcelas, LocalDate dataPrimeiraParcela) {
        CompraParcelada dados = new CompraParcelada();
        dados.setDescricao("Notebook");
        dados.setValorTotal(new BigDecimal(valorTotal));
        dados.setNumeroParcelas(numeroParcelas);
        dados.setCategoriaId(CATEGORIA);
        dados.setDataPrimeiraParcela(dataPrimeiraParcela);
        return dados;
    }

    // Primeira data >= referência com esse dia do mês, num mês que tenha o dia -
    // usado por testes de clamping (dia 31) sem depender do tamanho do mês corrente.
    private LocalDate dataComDia(int dia) {
        YearMonth mes = YearMonth.now();
        while (mes.lengthOfMonth() < dia) {
            mes = mes.plusMonths(1);
        }
        return mes.atDay(dia);
    }

    @SuppressWarnings("unchecked")
    private List<Gasto> parcelasGeradas(int quantidadeEsperada) {
        ArgumentCaptor<List<Gasto>> captor = ArgumentCaptor.forClass(List.class);
        // as parcelas são persistidas de uma vez, num único salvarParcelas em lote
        verify(gastoService).salvarParcelas(captor.capture(), any());
        List<Gasto> parcelas = captor.getValue();
        assertThat(parcelas).hasSize(quantidadeEsperada);
        return parcelas;
    }

    private static BigDecimal somar(List<Gasto> parcelas) {
        return parcelas.stream().map(Gasto::getValor).reduce(BigDecimal.ZERO, BigDecimal::add);
    }

    private GastoRepository.ParcelasPorCompra contagem(int compraId, long total) {
        GastoRepository.ParcelasPorCompra projecao = mock(GastoRepository.ParcelasPorCompra.class);
        when(projecao.getCompraId()).thenReturn(compraId);
        when(projecao.getTotal()).thenReturn(total);
        return projecao;
    }

    private CompraParcelada compraComId(int id, int numeroParcelas) {
        CompraParcelada c = new CompraParcelada();
        c.setId(id);
        c.setNumeroParcelas(numeroParcelas);
        return c;
    }

    @Test
    void listarTodos_preencheParcelasLancadas_incluindoParcelamentoIncompleto() {
        // constrói os mocks de projeção ANTES do when(...) - Mockito não deixa
        // stubar um mock dentro de outro stubbing ainda aberto.
        GastoRepository.ParcelasPorCompra c1 = contagem(1, 3L);
        GastoRepository.ParcelasPorCompra c2 = contagem(2, 2L);
        when(repository.findAllByUsuarioIdOrderByDataCriacaoDesc(USUARIO))
                .thenReturn(List.of(compraComId(1, 3), compraComId(2, 3), compraComId(3, 4)));
        when(gastoRepository.contarParcelasPorCompra(USUARIO)).thenReturn(List.of(c1, c2));
        // compra 3 não tem contagem nenhuma -> 0 parcelas

        List<CompraParcelada> resultado = service.listarTodos(USUARIO);

        assertThat(resultado.get(0).getParcelasLancadas()).isEqualTo(3);
        assertThat(resultado.get(1).getParcelasLancadas()).isEqualTo(2);
        assertThat(resultado.get(2).getParcelasLancadas()).isZero();
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
    void rejeitaMaisDe120ParcelasSemGravarNada() {
        assertThatThrownBy(() -> service.cadastrar(compra("12100.00", 121), USUARIO))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("entre 2 e 120");

        verify(repository, never()).save(any());
        verifyNoInteractions(gastoService);
    }

    @Test
    void resolveCategoriaUmaVezSoIndependenteDoNumeroDeParcelas() {
        service.cadastrar(compra("2400.00", 120), USUARIO);

        List<Gasto> parcelas = parcelasGeradas(120);
        assertThat(parcelas).allSatisfy(parcela -> assertThat(parcela.getCategoria()).isEqualTo("Compras"));

        // o ponto da otimização: 1 resolução de categoria pra compra inteira, não 120
        verify(categoriaRepository, times(1)).findByIdVisivel(any(), any());
        verifyNoInteractions(subcategoriaRepository);
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
    void primeiraParcelaCaiExatamenteNaDataInformada() {
        LocalDate inicio = LocalDate.now().minusMonths(1).withDayOfMonth(10);
        service.cadastrar(compra("300.00", 3, inicio), USUARIO);

        assertThat(parcelasGeradas(3).get(0).getData()).isEqualTo(inicio);
    }

    @Test
    void dataRetroativaGeraParcelasNoPassadoPresenteEFuturo() {
        // compra do mês passado só agora registrada: 1ª parcela já venceu, 2ª cai
        // neste mês, 3ª é futura.
        LocalDate inicio = LocalDate.now().minusMonths(1).withDayOfMonth(10);
        service.cadastrar(compra("300.00", 3, inicio), USUARIO);

        List<LocalDate> datas = parcelasGeradas(3).stream().map(Gasto::getData).toList();
        LocalDate hoje = LocalDate.now();
        assertThat(datas.get(0)).isBefore(hoje);
        assertThat(YearMonth.from(datas.get(1))).isEqualTo(YearMonth.from(hoje));
        assertThat(datas.get(2)).isAfter(hoje);
    }

    @Test
    void rejeitaPrimeiraParcelaMaisDe12MesesNoPassadoSemGravarNada() {
        assertThatThrownBy(() ->
                service.cadastrar(compra("300.00", 3, LocalDate.now().minusMonths(13)), USUARIO))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("12 meses");

        verify(repository, never()).save(any());
        verifyNoInteractions(gastoService);
    }

    @Test
    void rejeitaPrimeiraParcelaMaisDe2MesesNoFuturoSemGravarNada() {
        assertThatThrownBy(() ->
                service.cadastrar(compra("300.00", 3, LocalDate.now().plusMonths(3)), USUARIO))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("futuro");

        verify(repository, never()).save(any());
        verifyNoInteractions(gastoService);
    }

    @Test
    void clampingDeDia_parcelaNoDia31CaiNoUltimoDiaDeFevereiroInclusiveEmAnoBissexto() {
        // 60 parcelas cobrem 5 anos - qualquer janela desse tamanho contém um
        // fevereiro comum (28), um fevereiro bissexto (29) e meses de 30 dias.
        service.cadastrar(compra("6000.00", 60, dataComDia(31)), USUARIO);

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

    @Test
    void geraMesesConsecutivosSemBuraco_inclusiveNaViradaDeAno() {
        // 14 parcelas: qualquer mês de início cobre pelo menos uma virada Dez -> Jan
        // (13+ meses consecutivos sempre contêm um Dezembro seguido de um Janeiro).
        service.cadastrar(compra("1400.00", 14), USUARIO);

        List<YearMonth> meses = parcelasGeradas(14).stream()
                .map(gasto -> YearMonth.from(gasto.getData()))
                .toList();

        assertThat(meses).doesNotHaveDuplicates();
        for (int i = 1; i < meses.size(); i++) {
            // cada parcela é exatamente 1 mês depois da anterior: sem pulo, sem repetição
            assertThat(meses.get(i))
                    .as("parcela %d deve ser o mês seguinte à parcela %d", i + 1, i)
                    .isEqualTo(meses.get(i - 1).plusMonths(1));
        }

        boolean cruzaVirada = false;
        for (int i = 1; i < meses.size(); i++) {
            if (meses.get(i - 1).getMonthValue() == 12 && meses.get(i).getMonthValue() == 1) {
                cruzaVirada = true;
            }
        }
        assertThat(cruzaVirada).as("14 parcelas devem cobrir uma virada de ano (Dez -> Jan)").isTrue();
    }
}
