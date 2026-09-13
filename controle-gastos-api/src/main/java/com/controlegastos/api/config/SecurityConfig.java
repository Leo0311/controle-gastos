package com.controlegastos.api.config;

import com.controlegastos.api.security.JwtAuthFilter;
import com.controlegastos.api.security.RateLimitAutenticadoFilter;
import com.controlegastos.api.security.RateLimitFilter;
import jakarta.servlet.http.HttpServletResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.web.servlet.FilterRegistrationBean;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.core.Ordered;
import org.springframework.http.HttpMethod;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configurers.AbstractHttpConfigurer;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.web.AuthenticationEntryPoint;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.CorsConfigurationSource;
import org.springframework.web.cors.UrlBasedCorsConfigurationSource;

import java.util.Arrays;
import java.util.List;

@Configuration
@RequiredArgsConstructor
public class SecurityConfig {

    private final JwtAuthFilter jwtAuthFilter;

    @Bean
    public PasswordEncoder passwordEncoder() {
        return new BCryptPasswordEncoder();
    }

    // Mesmo formato {"erro": "..."} do resto da API (GlobalExceptionHandler) - o
    // frontend (NotificacaoService.mensagemDeErro) já espera esse shape.
    @Bean
    public AuthenticationEntryPoint authenticationEntryPoint() {
        return (request, response, authException) -> {
            response.setStatus(HttpServletResponse.SC_UNAUTHORIZED);
            response.setContentType("application/json;charset=UTF-8");
            response.getWriter().write("{\"erro\":\"Sessão expirada ou inválida. Faça login novamente.\"}");
        };
    }

    @Bean
    public SecurityFilterChain securityFilterChain(
            HttpSecurity http, CorsConfigurationSource corsConfigurationSource) throws Exception {
        http
                .cors(cors -> cors.configurationSource(corsConfigurationSource))
                .csrf(AbstractHttpConfigurer::disable)
                .sessionManagement(sm -> sm.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
                // Dívida técnica de segurança (baixa prioridade): CSP ausente. Esta API só
                // devolve JSON - nunca serve HTML/JS/CSS que um navegador renderize como
                // documento -, então o mais seguro é bloquear tudo (`'none'`) em vez de tentar
                // adivinhar uma allowlist. Não afeta o frontend: o CSP de uma resposta vale só
                // para o próprio documento que a recebe como navegação de página, nunca para
                // quem faz fetch/XHR nela a partir de outra origem - a Angular app (Render)
                // continua carregando fontes/chamando a API normalmente, sob o CSP dela
                // própria (ou a ausência dele), não o desta API.
                .headers(headers -> headers.contentSecurityPolicy(csp -> csp
                        .policyDirectives("default-src 'none'; frame-ancestors 'none'; base-uri 'none'")))
                .authorizeHttpRequests(auth -> auth
                        .requestMatchers(HttpMethod.OPTIONS, "/**").permitAll()
                        .requestMatchers("/api/auth/**").permitAll()
                        // GET *e* HEAD: monitores de uptime (UptimeRobot) mandam HEAD quando o
                        // monitor não tem checagem de keyword configurada - descoberto em
                        // produção em 2026-09-12 (o monitor novo do /smtp veio como HEAD e
                        // tomou 403; o do /api/health original só nunca pegou esse caminho
                        // porque o monitor dele usa GET). @GetMapping já responde HEAD
                        // automaticamente (Spring MVC), então só faltava liberar aqui.
                        .requestMatchers(HttpMethod.GET, "/api/health", "/api/health/smtp").permitAll()
                        .requestMatchers(HttpMethod.HEAD, "/api/health", "/api/health/smtp").permitAll()
                        .anyRequest().authenticated()
                )
                // Sem isto, o Spring Security cai no padrão (Http403ForbiddenEntryPoint) pra
                // qualquer falha de autenticação - token ausente, inválido, expirado ou com
                // token_version revogado (JwtAuthFilter não seta Authentication nenhuma nesses
                // casos, sem lançar exceção) viravam 403, indistinguíveis de uma autorização
                // negada de verdade. Este projeto não tem @PreAuthorize/hasRole/AccessDenied em
                // lugar nenhum (auditoria 2026-09-13 confirmou) - toda a autorização por dono do
                // dado é feita a nível de repositório (findByIdAndUsuarioId -> 404, nunca 403),
                // então não existe hoje um caso real de "autenticado mas sem permissão" que
                // dependesse do 403 default. Com isto, falha de autenticação sempre vira 401 -
                // o único ExceptionHandler que já devolvia 401 (CredenciaisInvalidasException,
                // em /api/auth/login) continua intacto, sem conflito (rotas diferentes).
                .exceptionHandling(exceptions -> exceptions.authenticationEntryPoint(authenticationEntryPoint()))
                .addFilterBefore(jwtAuthFilter, UsernamePasswordAuthenticationFilter.class)
                // Depois do JwtAuthFilter: já há um UsuarioPrincipal no contexto para
                // a contagem por usuário dos endpoints de escrita pesada (achado M2).
                .addFilterAfter(new RateLimitAutenticadoFilter(), JwtAuthFilter.class);

        return http.build();
    }

    // Rate limiting registrado como filtro de servlet comum, com a maior
    // precedência possível, para que as tentativas em excesso sejam barradas com
    // 429 antes da cadeia do Spring Security e de qualquer processamento de
    // autenticação (validação de token/credenciais).
    @Bean
    public FilterRegistrationBean<RateLimitFilter> rateLimitFilterRegistration() {
        FilterRegistrationBean<RateLimitFilter> registro = new FilterRegistrationBean<>(new RateLimitFilter());
        registro.setOrder(Ordered.HIGHEST_PRECEDENCE);
        registro.addUrlPatterns("/api/auth/*", "/api/health/smtp");
        return registro;
    }

    // Em produção, app.cors.allowed-origins é definido em application-prod.properties (dev
    // local + domínio do Render). O valor padrão abaixo só vale quando a propriedade não
    // existe (perfil local), preservando o comportamento atual sem tocar application.properties.
    @Bean
    public CorsConfigurationSource corsConfigurationSource(
            @Value("${app.cors.allowed-origins:http://localhost:4200}") String origensPermitidas) {
        CorsConfiguration config = new CorsConfiguration();
        config.setAllowedOrigins(Arrays.stream(origensPermitidas.split(","))
                .map(String::trim)
                .filter(origem -> !origem.isBlank())
                .toList());
        config.setAllowedMethods(List.of("GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"));
        config.setAllowedHeaders(List.of("*"));

        UrlBasedCorsConfigurationSource source = new UrlBasedCorsConfigurationSource();
        source.registerCorsConfiguration("/**", config);
        return source;
    }
}
