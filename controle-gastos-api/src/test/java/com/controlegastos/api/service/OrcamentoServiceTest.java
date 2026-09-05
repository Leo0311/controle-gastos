package com.controlegastos.api.service;

import com.controlegastos.api.dto.OrcamentoMesDTO;
import com.controlegastos.api.exception.RecursoNaoEncontradoException;
import com.controlegastos.api.model.Categoria;
import com.controlegastos.api.model.Orcamento;
import com.controlegastos.api.model.Subcategoria;
import com.controlegastos.api.repository.CategoriaRepository;
import com.controlegastos.api.repository.GastoRepository;
import com.controlegastos.api.repository.OrcamentoRepository;
import com.controlegastos.api.repository.SubcategoriaRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;

import java.math.BigDecimal;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.anyList;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.ArgumentMatchers.isNull;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * Cobertura de OrcamentoService - Mockito puro, sem banco e sem @SpringBootTest,
 * mesmo padrão de GastoServiceTest / CompraParceladaServiceTest (achado M4 da
 * auditoria 2026-09-05: a classe estava com zero testes).
 *
 * Foco: os quatro ramos de validar(), os quatro ramos de resolverCategoria(),
 * a checagem de duplicidade (incluindo a sentinela SEM_ID no create e a
 * auto-exclusão pelo próprio id no update), o escopo por usuário em
 * atualizar/excluir, e os três status financeiros de orcamentosDoMes() nas suas
 * fronteiras - inclusive o limiar de 80% e o vínculo por orcamento_id que a
 * agregação do achado R3 introduziu.
 */
class OrcamentoServiceTest {

    private static final int USUARIO = 1;
    private static final int CATEGORIA = 5;
    private static final int SUBCATEGORIA = 30;
    private static final int MES = 6;
    private static final int ANO = 2026;

    private final OrcamentoRepository repository = mock(OrcamentoRepository.class);
    private final GastoRepository gastoRepository = mock(GastoRepository.class);
    private final CategoriaRepository categoriaRepository = mock(CategoriaRepository.class);
    private final SubcategoriaRepository subcategoriaRepository = mock(SubcategoriaRepository.class);

    private final OrcamentoService service = new OrcamentoService(
            repository, gastoRepository, categoriaRepository, subcategoriaRepository);

    @BeforeEach
    void stubsPadrao() {
        Categoria categoria = new Categoria();
        categoria.setId(CATEGORIA);
        categoria.setNome("Alimentação");
        when(categoriaRepository.findByIdVisivel(CATEGORIA, USUARIO)).thenReturn(Optional.of(categoria));

        Subcategoria subcategoria = new Subcategoria();
        subcategoria.setId(SUBCATEGORIA);
        subcategoria.setCategoriaId(CATEGORIA);
        subcategoria.setNome("Restaurante");
        when(subcategoriaRepository.findByIdVisivel(SUBCATEGORIA, USUARIO)).thenReturn(Optional.of(subcategoria));

        // Nenhum duplicado, salvo teste que sobrescreve.
        when(repository.findDuplicado(any(), any(), any(), anyInt(), anyInt(), any()))
                .thenReturn(Optional.empty());
        when(repository.save(any(Orcamento.class))).thenAnswer(invocacao -> invocacao.getArgument(0));
    }

    private Orcamento orcamentoValido() {
        Orcamento o = new Orcamento();
        o.setCategoriaId(CATEGORIA);
        o.setValorLimite(new BigDecimal("100.00"));
        o.setMes(MES);
        o.setAno(ANO);
        return o;
    }

    // ---------- validar() ----------

    @Test
    void definir_rejeitaCategoriaIdNulo() {
        Orcamento o = orcamentoValido();
        o.setCategoriaId(null);

        assertThatThrownBy(() -> service.definir(o, USUARIO))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("Categoria não pode ser vazia");
    }

    @Test
    void definir_rejeitaValorLimiteNulo() {
        Orcamento o = orcamentoValido();
        o.setValorLimite(null);

        assertThatThrownBy(() -> service.definir(o, USUARIO))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("Valor limite deve ser maior que zero");
    }

    @Test
    void definir_rejeitaValorLimiteZero() {
        Orcamento o = orcamentoValido();
        o.setValorLimite(BigDecimal.ZERO);

        assertThatThrownBy(() -> service.definir(o, USUARIO))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("maior que zero");
    }

    @Test
    void definir_rejeitaValorLimiteNegativo() {
        Orcamento o = orcamentoValido();
        o.setValorLimite(new BigDecimal("-1"));

        assertThatThrownBy(() -> service.definir(o, USUARIO))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("maior que zero");
    }

    @Test
    void definir_rejeitaMesZero() {
        Orcamento o = orcamentoValido();
        o.setMes(0);

        assertThatThrownBy(() -> service.definir(o, USUARIO))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("Mês inválido");
    }

    @Test
    void definir_rejeitaMesTreze() {
        Orcamento o = orcamentoValido();
        o.setMes(13);

        assertThatThrownBy(() -> service.definir(o, USUARIO))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("Mês inválido");
    }

    @Test
    void definir_rejeitaAnoZero() {
        Orcamento o = orcamentoValido();
        o.setAno(0);

        assertThatThrownBy(() -> service.definir(o, USUARIO))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("Ano inválido");
    }

    @Test
    void definir_aceitaMesesDeFronteira() {
        Orcamento janeiro = orcamentoValido();
        janeiro.setMes(1);
        Orcamento dezembro = orcamentoValido();
        dezembro.setMes(12);

        assertThat(service.definir(janeiro, USUARIO)).isNotNull();
        assertThat(service.definir(dezembro, USUARIO)).isNotNull();
    }

    // ---------- resolverCategoria() ----------

    @Test
    void definir_rejeitaCategoriaQueNaoPertenceAoUsuario() {
        Orcamento o = orcamentoValido();
        o.setCategoriaId(999); // não stubado -> findByIdVisivel devolve Optional.empty()

        assertThatThrownBy(() -> service.definir(o, USUARIO))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("Categoria inválida ou não pertence ao usuário");
    }

    @Test
    void definir_rejeitaSubcategoriaQueNaoPertenceAoUsuario() {
        Orcamento o = orcamentoValido();
        o.setSubcategoriaId(888); // não stubado

        assertThatThrownBy(() -> service.definir(o, USUARIO))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("Subcategoria inválida ou não pertence ao usuário");
    }

    @Test
    void definir_rejeitaSubcategoriaDeOutraCategoria() {
        Subcategoria deOutra = new Subcategoria();
        deOutra.setId(SUBCATEGORIA);
        deOutra.setCategoriaId(CATEGORIA + 1);
        deOutra.setNome("Não é dessa categoria");
        when(subcategoriaRepository.findByIdVisivel(SUBCATEGORIA, USUARIO)).thenReturn(Optional.of(deOutra));

        Orcamento o = orcamentoValido();
        o.setSubcategoriaId(SUBCATEGORIA);

        assertThatThrownBy(() -> service.definir(o, USUARIO))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("Subcategoria não pertence à categoria selecionada");
    }

    @Test
    void definir_espelhaNomeDaCategoriaEDeixaSubcategoriaNulaQuandoNaoInformada() {
        Orcamento salvo = service.definir(orcamentoValido(), USUARIO);

        assertThat(salvo.getCategoria()).isEqualTo("Alimentação");
        assertThat(salvo.getSubcategoria()).isNull();
    }

    @Test
    void definir_espelhaNomeDaSubcategoriaQuandoInformada() {
        Orcamento o = orcamentoValido();
        o.setSubcategoriaId(SUBCATEGORIA);

        Orcamento salvo = service.definir(o, USUARIO);

        assertThat(salvo.getSubcategoria()).isEqualTo("Restaurante");
    }

    // ---------- definir() ----------

    @Test
    void definir_forcaIdNuloEAtribuiUsuarioDoServidor() {
        Orcamento o = orcamentoValido();
        o.setId(999);
        o.setUsuarioId(42);

        service.definir(o, USUARIO);

        ArgumentCaptor<Orcamento> captor = ArgumentCaptor.forClass(Orcamento.class);
        verify(repository).save(captor.capture());
        assertThat(captor.getValue().getId()).isNull();
        assertThat(captor.getValue().getUsuarioId()).isEqualTo(USUARIO);
    }

    @Test
    void definir_passaSentinelaSemIdNaChecagemDeDuplicidade() {
        service.definir(orcamentoValido(), USUARIO);

        verify(repository).findDuplicado(eq(USUARIO), eq(CATEGORIA), isNull(), eq(MES), eq(ANO), eq(0));
    }

    @Test
    void definir_rejeitaDuplicadoGeralSemSalvar() {
        when(repository.findDuplicado(any(), any(), any(), anyInt(), anyInt(), any()))
                .thenReturn(Optional.of(new Orcamento()));

        assertThatThrownBy(() -> service.definir(orcamentoValido(), USUARIO))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("orçamento geral");

        verify(repository, never()).save(any());
    }

    @Test
    void definir_rejeitaDuplicadoDeSubcategoriaComMensagemPropria() {
        when(repository.findDuplicado(any(), any(), any(), anyInt(), anyInt(), any()))
                .thenReturn(Optional.of(new Orcamento()));

        Orcamento o = orcamentoValido();
        o.setSubcategoriaId(SUBCATEGORIA);

        assertThatThrownBy(() -> service.definir(o, USUARIO))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("categoria/subcategoria/mês/ano");

        verify(repository, never()).save(any());
    }

    // ---------- atualizar() ----------

    @Test
    void atualizar_lancaNaoEncontradoQuandoOrcamentoNaoEhDoUsuario() {
        when(repository.findByIdAndUsuarioId(7, USUARIO)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> service.atualizar(7, orcamentoValido(), USUARIO))
                .isInstanceOf(RecursoNaoEncontradoException.class)
                .hasMessageContaining("ID 7");

        verify(repository, never()).save(any());
    }

    @Test
    void atualizar_validaAntesDeVerificarExistencia() {
        // Documenta a ordem atual: validar()/resolverCategoria() rodam antes do
        // findByIdAndUsuarioId, então payload inválido em id inexistente dá 400, não 404.
        Orcamento invalido = orcamentoValido();
        invalido.setCategoriaId(null);

        assertThatThrownBy(() -> service.atualizar(999, invalido, USUARIO))
                .isInstanceOf(IllegalArgumentException.class);

        verify(repository, never()).findByIdAndUsuarioId(anyInt(), anyInt());
    }

    @Test
    void atualizar_rejeitaDuplicadoQueNaoSejaOProprioRegistro() {
        Orcamento existente = orcamentoValido();
        existente.setId(3);
        when(repository.findByIdAndUsuarioId(3, USUARIO)).thenReturn(Optional.of(existente));
        when(repository.findDuplicado(any(), any(), any(), anyInt(), anyInt(), any()))
                .thenReturn(Optional.of(new Orcamento()));

        assertThatThrownBy(() -> service.atualizar(3, orcamentoValido(), USUARIO))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("Já existe");

        verify(repository, never()).save(any());
    }

    @Test
    void atualizar_excluiOProprioIdDaChecagemDeDuplicidade() {
        Orcamento existente = orcamentoValido();
        existente.setId(3);
        when(repository.findByIdAndUsuarioId(3, USUARIO)).thenReturn(Optional.of(existente));

        service.atualizar(3, orcamentoValido(), USUARIO);

        verify(repository).findDuplicado(eq(USUARIO), eq(CATEGORIA), isNull(), eq(MES), eq(ANO), eq(3));
    }

    @Test
    void atualizar_copiaTodosOsCamposERecalculaOsNomes() {
        Orcamento existente = new Orcamento();
        existente.setId(3);
        existente.setUsuarioId(USUARIO);
        existente.setCategoriaId(CATEGORIA);
        existente.setCategoria("Alimentação");
        existente.setValorLimite(new BigDecimal("100.00"));
        existente.setMes(1);
        existente.setAno(2025);
        when(repository.findByIdAndUsuarioId(3, USUARIO)).thenReturn(Optional.of(existente));

        Categoria lazer = new Categoria();
        lazer.setId(9);
        lazer.setNome("Lazer");
        when(categoriaRepository.findByIdVisivel(9, USUARIO)).thenReturn(Optional.of(lazer));

        Orcamento dados = new Orcamento();
        dados.setCategoriaId(9);
        dados.setValorLimite(new BigDecimal("250.00"));
        dados.setMes(12);
        dados.setAno(2026);

        Orcamento salvo = service.atualizar(3, dados, USUARIO);

        assertThat(salvo.getCategoriaId()).isEqualTo(9);
        assertThat(salvo.getCategoria()).isEqualTo("Lazer");
        assertThat(salvo.getValorLimite()).isEqualByComparingTo("250.00");
        assertThat(salvo.getMes()).isEqualTo(12);
        assertThat(salvo.getAno()).isEqualTo(2026);
    }

    @Test
    void atualizar_limpaSubcategoriaAntigaQuandoSubcategoriaIdVemNulo() {
        Orcamento existente = new Orcamento();
        existente.setId(3);
        existente.setUsuarioId(USUARIO);
        existente.setCategoriaId(CATEGORIA);
        existente.setSubcategoriaId(SUBCATEGORIA);
        existente.setSubcategoria("Restaurante");
        existente.setValorLimite(new BigDecimal("100.00"));
        existente.setMes(MES);
        existente.setAno(ANO);
        when(repository.findByIdAndUsuarioId(3, USUARIO)).thenReturn(Optional.of(existente));

        Orcamento dados = orcamentoValido();
        dados.setSubcategoriaId(null);

        Orcamento salvo = service.atualizar(3, dados, USUARIO);

        assertThat(salvo.getSubcategoriaId()).isNull();
        assertThat(salvo.getSubcategoria()).isNull();
    }

    // ---------- excluir() ----------

    @Test
    void excluir_lancaNaoEncontradoQuandoOrcamentoNaoEhDoUsuario() {
        when(repository.findByIdAndUsuarioId(7, USUARIO)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> service.excluir(7, USUARIO))
                .isInstanceOf(RecursoNaoEncontradoException.class);

        verify(repository, never()).delete(any());
    }

    @Test
    void excluir_apagaOOrcamentoDoProprioUsuario() {
        Orcamento existente = orcamentoValido();
        existente.setId(7);
        when(repository.findByIdAndUsuarioId(7, USUARIO)).thenReturn(Optional.of(existente));

        service.excluir(7, USUARIO);

        verify(repository).delete(existente);
    }

    // ---------- orcamentosDoMes() ----------

    private Orcamento orcamentoDoMes(int id, String limite) {
        Orcamento o = new Orcamento();
        o.setId(id);
        o.setCategoriaId(CATEGORIA);
        o.setCategoria("Alimentação");
        o.setValorLimite(new BigDecimal(limite));
        o.setMes(MES);
        o.setAno(ANO);
        return o;
    }

    private static GastoRepository.OrcamentoTotal total(int orcamentoId, String valor) {
        return new GastoRepository.OrcamentoTotal() {
            @Override
            public Integer getOrcamentoId() {
                return orcamentoId;
            }

            @Override
            public BigDecimal getTotal() {
                return new BigDecimal(valor);
            }
        };
    }

    @Test
    void orcamentosDoMes_listaVaziaNaoDisparaAQueryDeAgregacao() {
        when(repository.findByUsuarioIdAndMesAndAno(USUARIO, MES, ANO)).thenReturn(List.of());

        assertThat(service.orcamentosDoMes(MES, ANO, USUARIO)).isEmpty();

        verify(gastoRepository, never()).somarPorOrcamentos(anyList());
    }

    @Test
    void orcamentosDoMes_orcamentoSemGastoTemGastoZeroETodosOsStatusFalsos() {
        when(repository.findByUsuarioIdAndMesAndAno(USUARIO, MES, ANO))
                .thenReturn(List.of(orcamentoDoMes(1, "100.00")));
        when(gastoRepository.somarPorOrcamentos(anyList())).thenReturn(List.of());

        OrcamentoMesDTO dto = service.orcamentosDoMes(MES, ANO, USUARIO).get(0);

        assertThat(dto.getGasto()).isEqualByComparingTo(BigDecimal.ZERO);
        assertThat(dto.isUltrapassou()).isFalse();
        assertThat(dto.isCompleto()).isFalse();
        assertThat(dto.isProximoDoLimite()).isFalse();
    }

    @Test
    void orcamentosDoMes_marcaUltrapassouQuandoGastoExcedeOLimite() {
        when(repository.findByUsuarioIdAndMesAndAno(USUARIO, MES, ANO))
                .thenReturn(List.of(orcamentoDoMes(1, "100.00")));
        when(gastoRepository.somarPorOrcamentos(anyList())).thenReturn(List.of(total(1, "150.00")));

        OrcamentoMesDTO dto = service.orcamentosDoMes(MES, ANO, USUARIO).get(0);

        assertThat(dto.isUltrapassou()).isTrue();
        assertThat(dto.isCompleto()).isFalse();
        assertThat(dto.isProximoDoLimite()).isFalse();
    }

    @Test
    void orcamentosDoMes_marcaCompletoQuandoGastoIgualaOLimiteMesmoComEscalasDiferentes() {
        when(repository.findByUsuarioIdAndMesAndAno(USUARIO, MES, ANO))
                .thenReturn(List.of(orcamentoDoMes(1, "100.00")));
        when(gastoRepository.somarPorOrcamentos(anyList())).thenReturn(List.of(total(1, "100")));

        OrcamentoMesDTO dto = service.orcamentosDoMes(MES, ANO, USUARIO).get(0);

        assertThat(dto.isCompleto()).isTrue();
        assertThat(dto.isUltrapassou()).isFalse();
        assertThat(dto.isProximoDoLimite()).isFalse();
    }

    @Test
    void orcamentosDoMes_marcaProximoDoLimiteNoLimiarExatoDeOitentaPorCento() {
        when(repository.findByUsuarioIdAndMesAndAno(USUARIO, MES, ANO))
                .thenReturn(List.of(orcamentoDoMes(1, "100.00")));
        when(gastoRepository.somarPorOrcamentos(anyList())).thenReturn(List.of(total(1, "80")));

        OrcamentoMesDTO dto = service.orcamentosDoMes(MES, ANO, USUARIO).get(0);

        assertThat(dto.isProximoDoLimite()).isTrue();
        assertThat(dto.isUltrapassou()).isFalse();
        assertThat(dto.isCompleto()).isFalse();
    }

    @Test
    void orcamentosDoMes_naoMarcaProximoDoLimiteLogoAbaixoDoLimiar() {
        when(repository.findByUsuarioIdAndMesAndAno(USUARIO, MES, ANO))
                .thenReturn(List.of(orcamentoDoMes(1, "100.00")));
        when(gastoRepository.somarPorOrcamentos(anyList())).thenReturn(List.of(total(1, "79.99")));

        OrcamentoMesDTO dto = service.orcamentosDoMes(MES, ANO, USUARIO).get(0);

        assertThat(dto.isProximoDoLimite()).isFalse();
        assertThat(dto.isUltrapassou()).isFalse();
        assertThat(dto.isCompleto()).isFalse();
    }

    @Test
    void orcamentosDoMes_somaCaiSoNoOrcamentoVinculadoPeloOrcamentoId() {
        when(repository.findByUsuarioIdAndMesAndAno(USUARIO, MES, ANO))
                .thenReturn(List.of(orcamentoDoMes(1, "100.00"), orcamentoDoMes(2, "200.00")));
        when(gastoRepository.somarPorOrcamentos(anyList())).thenReturn(List.of(total(1, "150.00")));

        List<OrcamentoMesDTO> dtos = service.orcamentosDoMes(MES, ANO, USUARIO);

        OrcamentoMesDTO comGasto = dtos.stream().filter(d -> d.getId() == 1).findFirst().orElseThrow();
        OrcamentoMesDTO semGasto = dtos.stream().filter(d -> d.getId() == 2).findFirst().orElseThrow();

        assertThat(comGasto.getGasto()).isEqualByComparingTo("150.00");
        assertThat(comGasto.isUltrapassou()).isTrue();
        assertThat(semGasto.getGasto()).isEqualByComparingTo(BigDecimal.ZERO);
        assertThat(semGasto.isUltrapassou()).isFalse();
        assertThat(semGasto.isProximoDoLimite()).isFalse();
    }
}
