package com.controlegastos.api.service;

import com.controlegastos.api.repository.CompraParceladaRepository;
import com.controlegastos.api.repository.GastoRecorrenteRepository;
import com.controlegastos.api.repository.GastoRepository;
import com.controlegastos.api.repository.OrcamentoRepository;
import org.junit.jupiter.api.Test;

import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

class ContadorDeUsoTest {

    private final GastoRepository gastos = mock(GastoRepository.class);
    private final OrcamentoRepository orcamentos = mock(OrcamentoRepository.class);
    private final GastoRecorrenteRepository recorrentes = mock(GastoRecorrenteRepository.class);
    private final CompraParceladaRepository parceladas = mock(CompraParceladaRepository.class);

    private final ContadorDeUso contador = new ContadorDeUso(gastos, orcamentos, recorrentes, parceladas);

    private void usoSubcategoria(long g, long o, long r, long p) {
        when(gastos.countBySubcategoriaId(9)).thenReturn(g);
        when(orcamentos.countBySubcategoriaId(9)).thenReturn(o);
        when(recorrentes.countBySubcategoriaId(9)).thenReturn(r);
        when(parceladas.countBySubcategoriaId(9)).thenReturn(p);
    }

    @Test
    void nadaEmUsoDevolveVazio() {
        usoSubcategoria(0, 0, 0, 0);
        assertThat(contador.descreverUsoSubcategoria(9)).isEmpty();
    }

    @Test
    void umUnicoTipoNoSingular() {
        usoSubcategoria(1, 0, 0, 0);
        assertThat(contador.descreverUsoSubcategoria(9)).contains("em uso em 1 gasto");
    }

    @Test
    void doisTiposLigadosPorE() {
        usoSubcategoria(2, 1, 0, 0);
        assertThat(contador.descreverUsoSubcategoria(9)).contains("em uso em 2 gastos e 1 orçamento");
    }

    @Test
    void tresOuMaisTiposComVirgulaEEAntesDoUltimo() {
        usoSubcategoria(3, 1, 1, 0);
        assertThat(contador.descreverUsoSubcategoria(9))
                .contains("em uso em 3 gastos, 1 orçamento e 1 gasto recorrente");
    }

    @Test
    void compraParceladaSozinhaTambemBloqueia() {
        usoSubcategoria(0, 0, 0, 1);
        assertThat(contador.descreverUsoSubcategoria(9)).contains("em uso em 1 compra parcelada");
    }

    @Test
    void pluralDeCompraParcelada() {
        usoSubcategoria(0, 0, 0, 4);
        assertThat(contador.descreverUsoSubcategoria(9)).contains("em uso em 4 compras parceladas");
    }

    @Test
    void categoriaUsaAsContagensDeCategoria() {
        when(gastos.countByCategoriaId(5)).thenReturn(2L);
        when(orcamentos.countByCategoriaId(5)).thenReturn(0L);
        when(recorrentes.countByCategoriaId(5)).thenReturn(0L);
        when(parceladas.countByCategoriaId(5)).thenReturn(1L);
        assertThat(contador.descreverUsoCategoria(5)).contains("em uso em 2 gastos e 1 compra parcelada");
    }

    @Test
    void todosOsQuatroTipos() {
        usoSubcategoria(1, 2, 3, 4);
        Optional<String> uso = contador.descreverUsoSubcategoria(9);
        assertThat(uso).contains(
                "em uso em 1 gasto, 2 orçamentos, 3 gastos recorrentes e 4 compras parceladas");
    }
}
