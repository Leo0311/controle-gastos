package com.controlegastos.api.config;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.HttpMethod;
import org.springframework.test.web.servlet.MockMvc;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.request;

/**
 * Regressão real de produção (2026-09-12, commit 3222482 -> correção logo em
 * seguida): o monitor do UptimeRobot cadastrado para /api/health/smtp manda
 * HEAD, não GET, porque não tem checagem de keyword configurada.
 * SecurityConfig liberava só {@code HttpMethod.GET} nesse caminho - HEAD caía
 * em {@code anyRequest().authenticated()} e o monitor anônimo tomava 403 em
 * vez do 200/503 esperado. O /api/health original tinha o mesmo problema
 * latente (nunca se manifestou porque o monitor dele usa GET).
 *
 * <p>Só esta camada (autorização HTTP) prova a regressão - os testes de
 * {@code HealthController} chamam os métodos Java direto, sem passar pelo
 * despacho por método HTTP do Spring MVC/Security.
 */
@SpringBootTest
@AutoConfigureMockMvc
class SecurityConfigHealthCheckTest {

    @Autowired
    private MockMvc mockMvc;

    @Test
    void getEHeadNaoExigemAutenticacaoNosDoisHealthChecks() throws Exception {
        for (String caminho : new String[]{"/api/health", "/api/health/smtp"}) {
            for (HttpMethod metodo : new HttpMethod[]{HttpMethod.GET, HttpMethod.HEAD}) {
                int status = mockMvc.perform(request(metodo, caminho))
                        .andReturn().getResponse().getStatus();

                assertThat(status)
                        .as("%s %s não deveria exigir autenticação (recebeu %d)", metodo, caminho, status)
                        .isNotIn(401, 403);
            }
        }
    }
}
