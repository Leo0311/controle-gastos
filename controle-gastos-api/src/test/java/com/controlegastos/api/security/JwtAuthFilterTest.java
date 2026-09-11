package com.controlegastos.api.security;

import com.controlegastos.api.model.Usuario;
import com.controlegastos.api.repository.UsuarioRepository;
import jakarta.servlet.FilterChain;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.security.core.context.SecurityContextHolder;

import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

// Achado de performance (rodada 2026-09-11): o filtro passa a cachear
// token_version em memória por TTL curto, em vez de bater no banco em toda
// requisição autenticada. Estes testes cobrem o cache, não o JWT em si (a
// validação de assinatura/expiração já é responsabilidade só de JwtService).
class JwtAuthFilterTest {

    private final JwtService jwtService = mock(JwtService.class);
    private final UsuarioRepository usuarioRepository = mock(UsuarioRepository.class);
    private final JwtAuthFilter filter = new JwtAuthFilter(jwtService, usuarioRepository);

    private final HttpServletRequest request = mock(HttpServletRequest.class);
    private final HttpServletResponse response = mock(HttpServletResponse.class);
    private final FilterChain chain = mock(FilterChain.class);

    private static final String TOKEN = "token-valido";

    @BeforeEach
    void limparContextoDeSeguranca() {
        SecurityContextHolder.clearContext();
        when(request.getHeader("Authorization")).thenReturn("Bearer " + TOKEN);
        when(jwtService.tokenValido(TOKEN)).thenReturn(true);
        when(jwtService.extrairUsuarioId(TOKEN)).thenReturn(7);
        when(jwtService.extrairTokenVersion(TOKEN)).thenReturn(2);
    }

    @AfterEach
    void limparDepois() {
        SecurityContextHolder.clearContext();
    }

    private Usuario usuario(int tokenVersion) {
        Usuario u = new Usuario();
        u.setId(7);
        u.setTokenVersion(tokenVersion);
        return u;
    }

    @Test
    void autentica_eSoConsultaOBancoUmaVezParaChamadasRepetidasDentroDoTtl() throws Exception {
        when(usuarioRepository.findById(7)).thenReturn(Optional.of(usuario(2)));

        filter.doFilter(request, response, chain);
        assertThat(SecurityContextHolder.getContext().getAuthentication()).isNotNull();
        SecurityContextHolder.clearContext();

        filter.doFilter(request, response, chain);
        assertThat(SecurityContextHolder.getContext().getAuthentication()).isNotNull();

        // A segunda chamada, dentro do TTL, veio do cache - nunca bateu no banco de novo.
        verify(usuarioRepository, org.mockito.Mockito.times(1)).findById(7);
    }

    @Test
    void naoAutentica_quandoVersaoDoTokenDivergeDaVersaoAtual() throws Exception {
        when(usuarioRepository.findById(7)).thenReturn(Optional.of(usuario(9)));

        filter.doFilter(request, response, chain);

        assertThat(SecurityContextHolder.getContext().getAuthentication()).isNull();
    }

    @Test
    void naoAutentica_quandoUsuarioNaoExisteENuncaCacheiaEsseCaso() throws Exception {
        when(usuarioRepository.findById(7)).thenReturn(Optional.empty());

        filter.doFilter(request, response, chain);
        filter.doFilter(request, response, chain);

        assertThat(SecurityContextHolder.getContext().getAuthentication()).isNull();
        // "Não encontrado" não é cacheado - toda chamada bate no banco de novo.
        verify(usuarioRepository, org.mockito.Mockito.times(2)).findById(7);
    }

    @Test
    void sempreDeixaARequisicaoSeguirNaCadeiaDeFiltros() throws Exception {
        when(usuarioRepository.findById(7)).thenReturn(Optional.of(usuario(2)));

        filter.doFilter(request, response, chain);

        verify(chain).doFilter(request, response);
    }

    @Test
    void naoConsultaOBanco_quandoNaoHaHeaderDeAutorizacao() throws Exception {
        when(request.getHeader("Authorization")).thenReturn(null);

        filter.doFilter(request, response, chain);

        assertThat(SecurityContextHolder.getContext().getAuthentication()).isNull();
        verify(usuarioRepository, never()).findById(eq(7));
    }
}
