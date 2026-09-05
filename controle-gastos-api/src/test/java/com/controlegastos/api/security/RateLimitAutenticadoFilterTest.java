package com.controlegastos.api.security;

import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockFilterChain;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Contagem por usuário autenticado nos endpoints de escrita pesada (achado M2).
 * Mesmo estilo do RateLimitFilterTest - MockHttpServletRequest, sem @SpringBootTest.
 */
class RateLimitAutenticadoFilterTest {

    private final RateLimitAutenticadoFilter filtro = new RateLimitAutenticadoFilter();

    @AfterEach
    void limparContexto() {
        SecurityContextHolder.clearContext();
    }

    private void autenticar(int usuarioId) {
        SecurityContextHolder.getContext().setAuthentication(
                new UsernamePasswordAuthenticationToken(new UsuarioPrincipal(usuarioId), null, List.of()));
    }

    private int chamar(String metodo, String uri) throws Exception {
        MockHttpServletResponse response = new MockHttpServletResponse();
        filtro.doFilter(new MockHttpServletRequest(metodo, uri), response, new MockFilterChain());
        return response.getStatus();
    }

    @Test
    void gastosEscrita_liberaAte400EBloqueiaAcima() throws Exception {
        autenticar(1);

        for (int i = 1; i <= RateLimitAutenticadoFilter.GASTOS_ESCRITA.maxRequisicoes(); i++) {
            assertThat(chamar("POST", "/api/gastos")).isEqualTo(200);
        }

        MockHttpServletResponse bloqueada = new MockHttpServletResponse();
        filtro.doFilter(new MockHttpServletRequest("POST", "/api/gastos"), bloqueada, new MockFilterChain());
        assertThat(bloqueada.getStatus()).isEqualTo(429);
        assertThat(bloqueada.getHeader("Retry-After")).isEqualTo("10");
        assertThat(bloqueada.getContentAsString()).contains("Muitas requisições");
    }

    @Test
    void gastosEscrita_postECompartilhamBucketComPutPorId() throws Exception {
        autenticar(1);
        int max = RateLimitAutenticadoFilter.GASTOS_ESCRITA.maxRequisicoes();

        for (int i = 0; i < max - 1; i++) {
            chamar("POST", "/api/gastos");
        }
        // a última do bucket, agora via PUT /api/gastos/{id}
        assertThat(chamar("PUT", "/api/gastos/42")).isEqualTo(200);
        // estourou
        assertThat(chamar("PUT", "/api/gastos/43")).isEqualTo(429);
    }

    @Test
    void contagemEhPorUsuario() throws Exception {
        autenticar(1);
        for (int i = 0; i <= RateLimitAutenticadoFilter.GASTOS_ESCRITA.maxRequisicoes(); i++) {
            chamar("POST", "/api/gastos");
        }
        assertThat(chamar("POST", "/api/gastos")).isEqualTo(429);

        autenticar(2);
        assertThat(chamar("POST", "/api/gastos")).isEqualTo(200);
    }

    @Test
    void contagemEhPorBucket() throws Exception {
        autenticar(1);
        for (int i = 0; i <= RateLimitAutenticadoFilter.GASTOS_ESCRITA.maxRequisicoes(); i++) {
            chamar("POST", "/api/gastos");
        }
        assertThat(chamar("POST", "/api/gastos")).isEqualTo(429);
        // outro bucket, mesmo usuário: livre
        assertThat(chamar("POST", "/api/compras-parceladas")).isEqualTo(200);
    }

    @Test
    void comprasParceladas_limiteBaixo() throws Exception {
        autenticar(3);
        for (int i = 1; i <= RateLimitAutenticadoFilter.COMPRAS_PARCELADAS.maxRequisicoes(); i++) {
            assertThat(chamar("POST", "/api/compras-parceladas")).isEqualTo(200);
        }
        assertThat(chamar("POST", "/api/compras-parceladas")).isEqualTo(429);
    }

    @Test
    void lancarPendentes_limiteProprio() throws Exception {
        autenticar(4);
        for (int i = 1; i <= RateLimitAutenticadoFilter.LANCAR_PENDENTES.maxRequisicoes(); i++) {
            assertThat(chamar("POST", "/api/gastos-recorrentes/lancar-pendentes")).isEqualTo(200);
        }
        MockHttpServletResponse bloqueada = new MockHttpServletResponse();
        filtro.doFilter(new MockHttpServletRequest("POST", "/api/gastos-recorrentes/lancar-pendentes"),
                bloqueada, new MockFilterChain());
        assertThat(bloqueada.getStatus()).isEqualTo(429);
        assertThat(bloqueada.getHeader("Retry-After")).isEqualTo("60");
    }

    @Test
    void naoLimitaLeituraNemEndpointsForaDaLista() throws Exception {
        autenticar(5);
        for (int i = 0; i < 500; i++) {
            assertThat(chamar("GET", "/api/gastos")).isEqualTo(200);
            assertThat(chamar("DELETE", "/api/gastos/9")).isEqualTo(200);
            assertThat(chamar("POST", "/api/orcamentos")).isEqualTo(200);
        }
    }

    @Test
    void semAutenticacaoNaoInterfere() throws Exception {
        // sem SecurityContext: deixa passar (a cadeia de segurança devolve 401 depois)
        for (int i = 0; i < 500; i++) {
            assertThat(chamar("POST", "/api/gastos")).isEqualTo(200);
        }
    }

    @Test
    void gastosRecorrentes_naoCaiNoBucketDeGastos() throws Exception {
        // /api/gastos-recorrentes começa com "/api/gastos" mas NÃO deve entrar no
        // bucket gastos-escrita (só /lancar-pendentes é limitado, com regra própria).
        autenticar(6);
        for (int i = 0; i < 500; i++) {
            assertThat(chamar("POST", "/api/gastos-recorrentes")).isEqualTo(200);
            assertThat(chamar("PUT", "/api/gastos-recorrentes/7")).isEqualTo(200);
        }
    }
}
