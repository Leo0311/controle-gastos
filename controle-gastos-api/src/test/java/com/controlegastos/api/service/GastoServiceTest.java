package com.controlegastos.api.service;

import com.controlegastos.api.model.Gasto;
import com.controlegastos.api.repository.CategoriaRepository;
import com.controlegastos.api.repository.GastoRepository;
import com.controlegastos.api.repository.OrcamentoRepository;
import com.controlegastos.api.repository.SubcategoriaRepository;
import org.junit.jupiter.api.Test;

import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * Proteção de GastoService.excluir: uma parcela de compra parcelada não pode ser
 * apagada isolada (deixaria o parcelamento incoerente) - Mockito puro.
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
}
