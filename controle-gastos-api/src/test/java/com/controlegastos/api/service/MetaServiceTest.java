package com.controlegastos.api.service;

import com.controlegastos.api.dto.MetaRequestDTO;
import com.controlegastos.api.model.Meta;
import com.controlegastos.api.model.Usuario;
import com.controlegastos.api.repository.GastoRepository;
import com.controlegastos.api.repository.MetaRepository;
import com.controlegastos.api.repository.UsuarioRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

/**
 * Cobertura de MetaService - Mockito puro, mesmo padrão de
 * OrcamentoServiceTest/CategoriaServiceTest. A classe estava sem nenhum teste;
 * cobre os ramos de validar()/validarMesAno() (definir() e metaDoMes(), este
 * último sem nenhuma validação até a auditoria de 2026-09-11 - achado fechado
 * nesta rodada) - a agregação de economia real de metaDoMes() em si não entra
 * no escopo.
 */
class MetaServiceTest {

    private static final int USUARIO = 1;
    private static final int MES = 6;
    private static final int ANO = 2026;

    private final MetaRepository repository = mock(MetaRepository.class);
    private final UsuarioRepository usuarioRepository = mock(UsuarioRepository.class);
    private final GastoRepository gastoRepository = mock(GastoRepository.class);

    private final MetaService service = new MetaService(repository, usuarioRepository, gastoRepository);

    @BeforeEach
    void stubsPadrao() {
        when(repository.findByUsuarioIdAndMesAndAno(anyInt(), anyInt(), anyInt())).thenReturn(Optional.empty());
        when(repository.save(any(Meta.class))).thenAnswer(invocacao -> invocacao.getArgument(0));
    }

    private MetaRequestDTO dadosValidos(int mes, int ano) {
        return new MetaRequestDTO(mes, ano, new BigDecimal("500.00"));
    }

    @Test
    void definir_rejeitaValorMetaNulo() {
        assertThatThrownBy(() -> service.definir(new MetaRequestDTO(MES, ANO, null), USUARIO))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("Valor da meta deve ser maior que zero");
    }

    @Test
    void definir_rejeitaValorMetaZeroOuNegativo() {
        assertThatThrownBy(() -> service.definir(new MetaRequestDTO(MES, ANO, BigDecimal.ZERO), USUARIO))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("maior que zero");
    }

    @Test
    void definir_rejeitaMesInvalido() {
        assertThatThrownBy(() -> service.definir(dadosValidos(13, ANO), USUARIO))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("Mês inválido");
    }

    @Test
    void definir_rejeitaAnoZero() {
        assertThatThrownBy(() -> service.definir(dadosValidos(MES, 0), USUARIO))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("Ano inválido");
    }

    @Test
    void definir_rejeitaAnoAbsurdamenteGrande() {
        assertThatThrownBy(() -> service.definir(dadosValidos(MES, 999999999), USUARIO))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("Ano inválido");
    }

    @Test
    void definir_aceitaAnoDentroDoTeto() {
        Meta salva = service.definir(dadosValidos(MES, LocalDate.now().getYear() + 1), USUARIO);

        assertThat(salva).isNotNull();
        assertThat(salva.getUsuarioId()).isEqualTo(USUARIO);
    }

    // ---------- metaDoMes() ----------

    @Test
    void metaDoMes_rejeitaMesInvalidoSemConsultarRepositorio() {
        assertThatThrownBy(() -> service.metaDoMes(13, ANO, USUARIO))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("Mês inválido");

        verifyNoInteractions(usuarioRepository, gastoRepository);
        verify(repository, never()).findByUsuarioIdAndMesAndAno(anyInt(), anyInt(), anyInt());
    }

    @Test
    void metaDoMes_rejeitaAnoAbsurdamenteGrandeSemConsultarRepositorio() {
        assertThatThrownBy(() -> service.metaDoMes(MES, 999999999, USUARIO))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("Ano inválido");

        verifyNoInteractions(usuarioRepository, gastoRepository);
        verify(repository, never()).findByUsuarioIdAndMesAndAno(anyInt(), anyInt(), anyInt());
    }

    @Test
    void metaDoMes_aceitaAnoDentroDoTeto() {
        Usuario usuario = new Usuario();
        usuario.setId(USUARIO);
        usuario.setRendaMensal(new BigDecimal("3000.00"));
        when(usuarioRepository.findById(USUARIO)).thenReturn(Optional.of(usuario));
        when(gastoRepository.somarNoPeriodo(any(), any(), any())).thenReturn(new BigDecimal("500.00"));

        int anoValido = LocalDate.now().getYear() + 1;
        assertThat(service.metaDoMes(MES, anoValido, USUARIO)).isNotNull();
    }
}
