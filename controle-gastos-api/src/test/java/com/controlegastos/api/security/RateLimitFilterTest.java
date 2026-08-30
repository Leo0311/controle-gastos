package com.controlegastos.api.security;

import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockFilterChain;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;

import static org.assertj.core.api.Assertions.assertThat;

class RateLimitFilterTest {

    private final RateLimitFilter filtro = new RateLimitFilter();

    private MockHttpServletResponse chamar(String metodo, String uri, String ip) throws Exception {
        MockHttpServletRequest request = new MockHttpServletRequest(metodo, uri);
        request.addHeader("X-Forwarded-For", ip);
        MockHttpServletResponse response = new MockHttpServletResponse();
        filtro.doFilter(request, response, new MockFilterChain());
        return response;
    }

    @Test
    void liberaAte5TentativasEBloqueiaAPartirDaSexta() throws Exception {
        for (int i = 1; i <= RateLimitFilter.MAX_REQUISICOES; i++) {
            assertThat(chamar("POST", "/api/auth/login", "10.0.0.1").getStatus()).isEqualTo(200);
        }

        MockHttpServletResponse bloqueada = chamar("POST", "/api/auth/login", "10.0.0.1");
        assertThat(bloqueada.getStatus()).isEqualTo(429);
        assertThat(bloqueada.getHeader("Retry-After")).isEqualTo("60");
        assertThat(bloqueada.getContentAsString()).contains("Muitas tentativas");
    }

    @Test
    void contagemEhPorIp() throws Exception {
        for (int i = 0; i < 6; i++) {
            chamar("POST", "/api/auth/login", "10.0.0.1");
        }

        assertThat(chamar("POST", "/api/auth/login", "10.0.0.2").getStatus()).isEqualTo(200);
    }

    @Test
    void contagemEhPorCaminho() throws Exception {
        for (int i = 0; i < 6; i++) {
            chamar("POST", "/api/auth/login", "10.0.0.3");
        }

        assertThat(chamar("POST", "/api/auth/cadastro", "10.0.0.3").getStatus()).isEqualTo(200);
    }

    @Test
    void naoLimitaOutrosEndpointsNemOutrosMetodos() throws Exception {
        for (int i = 0; i < 20; i++) {
            assertThat(chamar("POST", "/api/gastos", "10.0.0.4").getStatus()).isEqualTo(200);
            assertThat(chamar("GET", "/api/auth/login", "10.0.0.4").getStatus()).isEqualTo(200);
        }
    }

    @Test
    void caiParaRemoteAddrQuandoNaoHaXForwardedFor() throws Exception {
        MockHttpServletRequest request = new MockHttpServletRequest("POST", "/api/auth/esqueci-senha");
        request.setRemoteAddr("192.168.0.9");
        MockHttpServletResponse response = new MockHttpServletResponse();

        for (int i = 0; i < 5; i++) {
            response = new MockHttpServletResponse();
            filtro.doFilter(request, response, new MockFilterChain());
            assertThat(response.getStatus()).isEqualTo(200);
        }
        response = new MockHttpServletResponse();
        filtro.doFilter(request, response, new MockFilterChain());
        assertThat(response.getStatus()).isEqualTo(429);
    }
}
