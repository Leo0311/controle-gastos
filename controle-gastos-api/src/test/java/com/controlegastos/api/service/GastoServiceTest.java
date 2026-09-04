package com.controlegastos.api.service;

import com.controlegastos.api.model.Categoria;
import com.controlegastos.api.model.Gasto;
import com.controlegastos.api.repository.CategoriaRepository;
import com.controlegastos.api.repository.GastoRepository;
import com.controlegastos.api.repository.OrcamentoRepository;
import com.controlegastos.api.repository.SubcategoriaRepository;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * Proteções de GastoService para parcela de compra parcelada: não pode ser apagada
 * isolada (excluir), e descrição/valor/data não podem ser alterados (atualizar) -
 * Mockito puro.
 */
class GastoServiceTest {

    private static final int USUARIO = 1;

    private final GastoRepository repository = mock(GastoRepository.class);
    private final OrcamentoRepository orcamentoRepository = mock(OrcamentoRepository.class);
    private final CategoriaRepository categoriaRepository = mock(CategoriaRepository.class);
    private final SubcategoriaRepository subcategoriaRepository = mock(SubcategoriaRepository.class);

    private final GastoService service = new GastoService(
            repository, orcamentoRepository, categoriaRepository, subcategoriaRepository);

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
}
