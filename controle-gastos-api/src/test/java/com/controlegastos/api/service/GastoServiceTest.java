package com.controlegastos.api.service;

import com.controlegastos.api.dto.GastoPaginaDTO;
import com.controlegastos.api.exception.GastoDuplicadoException;
import com.controlegastos.api.model.Categoria;
import com.controlegastos.api.model.Gasto;
import com.controlegastos.api.repository.CategoriaRepository;
import com.controlegastos.api.repository.GastoRepository;
import com.controlegastos.api.repository.OrcamentoRepository;
import com.controlegastos.api.repository.SubcategoriaRepository;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.ArgumentMatchers.isNull;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * Proteções de GastoService para parcela de compra parcelada: não pode ser apagada
 * isolada (excluir), e descrição/valor/data não podem ser alterados (atualizar) -
 * Mockito puro. Também cobre a janela de data de validar() (achado R1 da auditoria
 * 2026-09-05).
 */
class GastoServiceTest {

    private static final int USUARIO = 1;
    private static final int CATEGORIA = 1;

    private final GastoRepository repository = mock(GastoRepository.class);
    private final OrcamentoRepository orcamentoRepository = mock(OrcamentoRepository.class);
    private final CategoriaRepository categoriaRepository = mock(CategoriaRepository.class);
    private final SubcategoriaRepository subcategoriaRepository = mock(SubcategoriaRepository.class);

    private final GastoService service = new GastoService(
            repository, orcamentoRepository, categoriaRepository, subcategoriaRepository);

    private Gasto gastoValido(LocalDate data) {
        Gasto gasto = new Gasto();
        gasto.setDescricao("Gasto de teste");
        gasto.setValor(new BigDecimal("10.00"));
        gasto.setCategoriaId(CATEGORIA);
        gasto.setData(data);
        return gasto;
    }

    private void stubCategoriaValida() {
        Categoria categoria = new Categoria();
        categoria.setId(CATEGORIA);
        categoria.setNome("Categoria de teste");
        when(categoriaRepository.findByIdVisivel(CATEGORIA, USUARIO)).thenReturn(Optional.of(categoria));
        when(repository.save(any(Gasto.class))).thenAnswer(invocacao -> invocacao.getArgument(0));
    }

    @Test
    void cadastrar_rejeitaDataMaisDeCemAnosNoPassado() {
        stubCategoriaValida();
        Gasto gasto = gastoValido(LocalDate.now().minusYears(100).minusDays(1));

        assertThatThrownBy(() -> service.cadastrar(gasto, USUARIO))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("anos atrás");
    }

    @Test
    void cadastrar_rejeitaDataMaisDeQuinzeAnosNoFuturo() {
        stubCategoriaValida();
        Gasto gasto = gastoValido(LocalDate.now().plusYears(15).plusDays(1));

        assertThatThrownBy(() -> service.cadastrar(gasto, USUARIO))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("no futuro");
    }

    @Test
    void cadastrar_aceitaDataNoLimiteExatoDaJanela() {
        stubCategoriaValida();

        assertThat(service.cadastrar(gastoValido(LocalDate.now().minusYears(100)), USUARIO)).isNotNull();
        assertThat(service.cadastrar(gastoValido(LocalDate.now().plusYears(15)), USUARIO)).isNotNull();
    }

    @Test
    void cadastrar_aceitaDataNull_recebeDefaultDeHojeDepoisDeValidar() {
        stubCategoriaValida();

        Gasto salvo = service.cadastrar(gastoValido(null), USUARIO);

        assertThat(salvo.getData()).isEqualTo(LocalDate.now());
    }

    @Test
    void cadastrar_aceitaDataNoLimiteDoPiorCasoDeUmaCompraParcelada() {
        // CompraParceladaService permite 1ª parcela até 2 meses no futuro e até 120
        // parcelas mensais - a ÚLTIMA parcela de uma compra legítima no limite cai em
        // hoje + 2 + 119 = hoje + 121 meses. A janela de GastoService.validar() (15
        // anos = 180 meses) precisa cobrir isso com folga, senão quebraria uma compra
        // parcelada válida - exatamente o conflito que a auditoria pediu pra evitar.
        stubCategoriaValida();
        Gasto ultimaParcelaDoPiorCaso = gastoValido(LocalDate.now().plusMonths(121));

        assertThat(service.cadastrar(ultimaParcelaDoPiorCaso, USUARIO)).isNotNull();
    }

    // ---------- deduplicação da importação (achado M6) ----------

    @Test
    void cadastrar_comDeduplicar_recusaQuandoJaExisteGastoEquivalente() {
        stubCategoriaValida();
        Gasto gasto = gastoValido(LocalDate.of(2026, 9, 1));
        when(repository.existeGastoEquivalente(
                USUARIO, LocalDate.of(2026, 9, 1), gasto.getValor(), gasto.getDescricao()))
                .thenReturn(true);

        assertThatThrownBy(() -> service.cadastrar(gasto, USUARIO, true))
                .isInstanceOf(GastoDuplicadoException.class)
                .hasMessageContaining("idêntico");

        verify(repository, never()).save(any());
    }

    @Test
    void cadastrar_comDeduplicar_salvaQuandoNaoHaEquivalente() {
        stubCategoriaValida();
        Gasto gasto = gastoValido(LocalDate.of(2026, 9, 1));
        when(repository.existeGastoEquivalente(any(), any(), any(), any())).thenReturn(false);

        assertThat(service.cadastrar(gasto, USUARIO, true)).isNotNull();
        verify(repository).save(any(Gasto.class));
    }

    @Test
    void cadastrar_comDeduplicar_semData_usaHojeNaChecagem() {
        stubCategoriaValida();
        when(repository.existeGastoEquivalente(any(), any(), any(), any())).thenReturn(false);

        service.cadastrar(gastoValido(null), USUARIO, true);

        verify(repository).existeGastoEquivalente(
                eq(USUARIO), eq(LocalDate.now()), any(BigDecimal.class), eq("Gasto de teste"));
    }

    @Test
    void cadastrar_semDeduplicar_naoConsultaEquivalenciaEPermiteGastoIgual() {
        stubCategoriaValida();

        assertThat(service.cadastrar(gastoValido(LocalDate.of(2026, 9, 1)), USUARIO)).isNotNull();

        verify(repository, never()).existeGastoEquivalente(any(), any(), any(), any());
    }

    @Test
    void excluir_rejeitaParcelaDeCompraParceladaSemApagarNada() {
        Gasto parcela = new Gasto();
        parcela.setId(10);
        parcela.setUsuarioId(USUARIO);
        parcela.setCompraParceladaId(99);
        when(repository.findByIdAndUsuarioId(10, USUARIO)).thenReturn(Optional.of(parcela));

        assertThatThrownBy(() -> service.excluir(10, USUARIO))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("Parceladas");

        verify(repository, never()).delete(any());
    }

    @Test
    void excluir_apagaGastoAvulsoNormalmente() {
        Gasto avulso = new Gasto();
        avulso.setId(11);
        avulso.setUsuarioId(USUARIO);
        when(repository.findByIdAndUsuarioId(11, USUARIO)).thenReturn(Optional.of(avulso));

        service.excluir(11, USUARIO);

        verify(repository).delete(avulso);
    }

    @Test
    void atualizar_parcelaIgnoraDescricaoValorEData_masTrocaCategoria() {
        Gasto parcela = new Gasto();
        parcela.setId(10);
        parcela.setUsuarioId(USUARIO);
        parcela.setCompraParceladaId(99);
        parcela.setDescricao("tenis (2/3)");
        parcela.setValor(new BigDecimal("100.00"));
        parcela.setData(LocalDate.of(2026, 10, 10));
        parcela.setCategoriaId(1);
        when(repository.findByIdAndUsuarioId(10, USUARIO)).thenReturn(Optional.of(parcela));

        Categoria lazer = new Categoria();
        lazer.setId(7);
        lazer.setNome("Lazer");
        when(categoriaRepository.findByIdVisivel(7, USUARIO)).thenReturn(Optional.of(lazer));
        when(repository.save(any(Gasto.class))).thenAnswer(invocacao -> invocacao.getArgument(0));

        Gasto dados = new Gasto();
        dados.setDescricao("outra coisa");
        dados.setValor(new BigDecimal("999.00"));
        dados.setData(LocalDate.of(2030, 1, 1));
        dados.setCategoriaId(7);

        Gasto salvo = service.atualizar(10, dados, USUARIO);

        assertThat(salvo.getDescricao()).isEqualTo("tenis (2/3)");
        assertThat(salvo.getValor()).isEqualByComparingTo("100.00");
        assertThat(salvo.getData()).isEqualTo(LocalDate.of(2026, 10, 10));
        assertThat(salvo.getCategoriaId()).isEqualTo(7);
        assertThat(salvo.getCategoria()).isEqualTo("Lazer");
    }

    @Test
    void atualizar_gastoAvulsoAlteraDescricaoValorEDataNormalmente() {
        Gasto avulso = new Gasto();
        avulso.setId(11);
        avulso.setUsuarioId(USUARIO);
        avulso.setDescricao("Cafe");
        avulso.setValor(new BigDecimal("12.00"));
        avulso.setData(LocalDate.of(2026, 9, 1));
        avulso.setCategoriaId(1);
        when(repository.findByIdAndUsuarioId(11, USUARIO)).thenReturn(Optional.of(avulso));

        Categoria alimentacao = new Categoria();
        alimentacao.setId(1);
        alimentacao.setNome("Alimentação");
        when(categoriaRepository.findByIdVisivel(1, USUARIO)).thenReturn(Optional.of(alimentacao));
        when(repository.save(any(Gasto.class))).thenAnswer(invocacao -> invocacao.getArgument(0));

        Gasto dados = new Gasto();
        dados.setDescricao("Cafe da tarde");
        dados.setValor(new BigDecimal("15.00"));
        dados.setData(LocalDate.of(2026, 9, 5));
        dados.setCategoriaId(1);

        Gasto salvo = service.atualizar(11, dados, USUARIO);

        assertThat(salvo.getDescricao()).isEqualTo("Cafe da tarde");
        assertThat(salvo.getValor()).isEqualByComparingTo("15.00");
        assertThat(salvo.getData()).isEqualTo(LocalDate.of(2026, 9, 5));
    }

    // ---------- listarPaginado() - achado C1 da auditoria 2026-09-05 ----------

    private Page<Gasto> paginaComUmGasto() {
        return new PageImpl<>(List.of(new Gasto()), PageRequest.of(0, 50), 1);
    }

    @Test
    void listarPaginado_semAnoBuscaTodoOHistorico_semJanelaDeData() {
        when(repository.buscarPagina(any(), any(), any(), any(), any())).thenReturn(paginaComUmGasto());

        service.listarPaginado(USUARIO, null, null, null, 0, 50);

        verify(repository).buscarPagina(eq(USUARIO), isNull(), isNull(), isNull(), any(Pageable.class));
    }

    @Test
    void listarPaginado_comMesEAnoDerivaAJanelaDoMes() {
        when(repository.buscarPagina(any(), any(), any(), any(), any())).thenReturn(paginaComUmGasto());

        service.listarPaginado(USUARIO, 2, 2024, null, 0, 50);

        // fevereiro de 2024 é bissexto -> 29 dias.
        verify(repository).buscarPagina(
                eq(USUARIO), isNull(),
                eq(LocalDate.of(2024, 2, 1)), eq(LocalDate.of(2024, 2, 29)), any(Pageable.class));
    }

    @Test
    void listarPaginado_soComAnoDerivaAJanelaDoAnoInteiro() {
        when(repository.buscarPagina(any(), any(), any(), any(), any())).thenReturn(paginaComUmGasto());

        service.listarPaginado(USUARIO, null, 2025, null, 0, 50);

        verify(repository).buscarPagina(
                eq(USUARIO), isNull(),
                eq(LocalDate.of(2025, 1, 1)), eq(LocalDate.of(2025, 12, 31)), any(Pageable.class));
    }

    @Test
    void listarPaginado_repassaOCategoriaId() {
        when(repository.buscarPagina(any(), any(), any(), any(), any())).thenReturn(paginaComUmGasto());

        service.listarPaginado(USUARIO, null, null, 7, 0, 50);

        verify(repository).buscarPagina(eq(USUARIO), eq(7), isNull(), isNull(), any(Pageable.class));
    }

    @Test
    void listarPaginado_rejeitaMesInvalido() {
        assertThatThrownBy(() -> service.listarPaginado(USUARIO, 13, 2025, null, 0, 50))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("Mês inválido");
    }

    @Test
    void listarPaginado_ordenaPorDataDescIdDescEClampaOTamanho() {
        when(repository.buscarPagina(any(), any(), any(), any(), any())).thenReturn(paginaComUmGasto());
        ArgumentCaptor<Pageable> captor = ArgumentCaptor.forClass(Pageable.class);

        service.listarPaginado(USUARIO, null, null, null, 3, 5000);

        verify(repository).buscarPagina(any(), any(), any(), any(), captor.capture());
        Pageable pageable = captor.getValue();
        assertThat(pageable.getPageNumber()).isEqualTo(3);
        assertThat(pageable.getPageSize()).isEqualTo(200); // teto
        assertThat(pageable.getSort()).isEqualTo(
                Sort.by(Sort.Order.desc("data"), Sort.Order.desc("id")));
    }

    @Test
    void listarPaginado_tamanhoInvalidoCaiNoPadrao() {
        when(repository.buscarPagina(any(), any(), any(), any(), any())).thenReturn(paginaComUmGasto());
        ArgumentCaptor<Pageable> captor = ArgumentCaptor.forClass(Pageable.class);

        service.listarPaginado(USUARIO, null, null, null, 0, 0);

        verify(repository).buscarPagina(any(), any(), any(), any(), captor.capture());
        assertThat(captor.getValue().getPageSize()).isEqualTo(50);
    }

    @Test
    void listarPaginado_mapeiaOsCamposDoPage() {
        Gasto g = new Gasto();
        Page<Gasto> pagina = new PageImpl<>(List.of(g), PageRequest.of(1, 50), 120);
        when(repository.buscarPagina(any(), any(), any(), any(), any())).thenReturn(pagina);

        GastoPaginaDTO dto = service.listarPaginado(USUARIO, null, null, null, 1, 50);

        assertThat(dto.conteudo()).containsExactly(g);
        assertThat(dto.pagina()).isEqualTo(1);
        assertThat(dto.totalItens()).isEqualTo(120);
        assertThat(dto.totalPaginas()).isEqualTo(3);
        assertThat(dto.ultima()).isFalse();
    }
}
