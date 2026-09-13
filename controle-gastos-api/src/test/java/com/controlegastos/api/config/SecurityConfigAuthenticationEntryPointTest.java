package com.controlegastos.api.config;

import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;

import javax.crypto.SecretKey;
import java.nio.charset.StandardCharsets;
import java.util.Date;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Achado 2 da auditoria de 2026-09-13: sem um {@link org.springframework.security.web.AuthenticationEntryPoint}
 * customizado, o Spring Security caía no padrão ({@code Http403ForbiddenEntryPoint}) pra
 * qualquer falha de autenticação - token ausente, adulterado ou expirado viravam 403,
 * indistinguível de uma autorização negada de verdade, e o frontend (que só trata
 * {@code erro.status === 401} pra deslogar/redirecionar - ver auth.interceptor.ts) nunca
 * detectava a sessão inválida. Confirmado ao vivo na auditoria (POST /api/gastos com token
 * forjado -> 403 real). Este teste prova a correção contra o filtro de segurança de
 * verdade (não um mock), nos três formatos de falha de autenticação que o app pode
 * encontrar em produção.
 */
@SpringBootTest
@AutoConfigureMockMvc
class SecurityConfigAuthenticationEntryPointTest {

    @Autowired
    private MockMvc mockMvc;

    @Value("${app.jwt.secret}")
    private String segredo;

    // Endpoint protegido comum, sem efeito colateral (GET, sem corpo) - qualquer um
    // sob anyRequest().authenticated() serviria; CategoriaController é o mais simples.
    private static final String ENDPOINT_PROTEGIDO = "/api/categorias";

    @Test
    void semHeaderDeAutorizacao_devolve401NaoMais403() throws Exception {
        mockMvc.perform(get(ENDPOINT_PROTEGIDO))
                .andExpect(status().isUnauthorized())
                .andExpect(content().contentTypeCompatibleWith(MediaType.APPLICATION_JSON))
                .andExpect(content().json("{\"erro\":\"Sessão expirada ou inválida. Faça login novamente.\"}"));
    }

    @Test
    void tokenAdulteradoOuComAssinaturaInvalida_devolve401NaoMais403() throws Exception {
        String tokenValidoQualquer = Jwts.builder()
                .subject("a@b.com")
                .claim("usuarioId", 1)
                .claim("tokenVersion", 0)
                .issuedAt(new Date())
                .expiration(new Date(System.currentTimeMillis() + 60_000))
                .signWith(chave())
                .compact();
        String tokenAdulterado = tokenValidoQualquer + "adulterado";

        mockMvc.perform(get(ENDPOINT_PROTEGIDO).header("Authorization", "Bearer " + tokenAdulterado))
                .andExpect(status().isUnauthorized())
                .andExpect(content().json("{\"erro\":\"Sessão expirada ou inválida. Faça login novamente.\"}"));
    }

    @Test
    void tokenExpirado_devolve401NaoMais403() throws Exception {
        // Mesma assinatura (segredo real de teste) que JwtService usaria, mas com
        // "exp" no passado - JwtService.gerarToken() nunca produz isso (sempre 6h no
        // futuro), por isso o token é montado aqui direto com a mesma lib (jjwt).
        String tokenExpirado = Jwts.builder()
                .subject("a@b.com")
                .claim("usuarioId", 1)
                .claim("tokenVersion", 0)
                .issuedAt(new Date(System.currentTimeMillis() - 120_000))
                .expiration(new Date(System.currentTimeMillis() - 60_000))
                .signWith(chave())
                .compact();

        mockMvc.perform(get(ENDPOINT_PROTEGIDO).header("Authorization", "Bearer " + tokenExpirado))
                .andExpect(status().isUnauthorized())
                .andExpect(content().json("{\"erro\":\"Sessão expirada ou inválida. Faça login novamente.\"}"));
    }

    @Test
    void loginComEmailInexistente_continuaDevolvendo401DoGlobalExceptionHandler_semConflitarComOEntryPoint() throws Exception {
        // /api/auth/** é permitAll (SecurityConfig) - o JwtAuthFilter/AuthenticationEntryPoint
        // novo nem entram em ação aqui. Este 401 é de CredenciaisInvalidasException via
        // GlobalExceptionHandler (mensagem de login, não a genérica de sessão) - prova que
        // os dois caminhos de 401 convivem sem conflito.
        mockMvc.perform(post("/api/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"email\":\"nao-existe@exemplo.com\",\"senha\":\"qualquer\"}"))
                .andExpect(status().isUnauthorized())
                .andExpect(content().json("{\"erro\":\"E-mail ou senha inválidos.\"}"));
    }

    private SecretKey chave() {
        return Keys.hmacShaKeyFor(segredo.getBytes(StandardCharsets.UTF_8));
    }
}
